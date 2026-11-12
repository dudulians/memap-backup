import UIKit
import Capacitor
import CoreHaptics
import Speech
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// MARK: - CoreHaptics plugin
//
// Custom Capacitor plugin that drives iOS Core Haptics directly. We
// reach for this instead of @capacitor/haptics' UIImpactFeedbackGenerator
// path because, on the user's device, that path silently fell back to
// the legacy AudioServicesPlaySystemSound buzzer (the "vibrate" call
// in our test) instead of triggering Taptic Engine. Games like
// Fishdom feel premium because they use Core Haptics; this plugin
// gives us the same access.
//
// Lives in AppDelegate.swift (rather than a separate file) so we don't
// have to register a new Swift source in App.xcodeproj/project.pbxproj
// — that's a brittle manual edit when there's no Mac to drive Xcode.
// AppDelegate.swift is already in the build sources phase, so Swift
// classes appended to its file are picked up automatically.
//
// The class conforms to CAPBridgedPlugin (Capacitor 7+ pattern) which
// declares its JS-visible methods inline; no Objective-C bridge file
// needed.

@objc(CoreHapticsPlugin)
public class CoreHapticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CoreHapticsPlugin"
    public let jsName = "CoreHaptics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "swipe", returnType: CAPPluginReturnNone),
        CAPPluginMethod(name: "tap", returnType: CAPPluginReturnNone),
        CAPPluginMethod(name: "medium", returnType: CAPPluginReturnNone),
        CAPPluginMethod(name: "success", returnType: CAPPluginReturnNone),
        CAPPluginMethod(name: "warning", returnType: CAPPluginReturnNone),
        CAPPluginMethod(name: "error", returnType: CAPPluginReturnNone),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnNone),
    ]

    private var engine: CHHapticEngine?

    private var supports: Bool {
        return CHHapticEngine.capabilitiesForHardware().supportsHaptics
    }

    public override func load() {
        guard supports else { return }
        do {
            engine = try CHHapticEngine()
            // vibration on its own, not tied to the app's sound: it went quiet everywhere while the
            // microphone (dictation) held the sound, and came back later (her note, Nov 12 2026)
            engine?.playsHapticsOnly = true
            // Restart automatically if iOS stops the engine for us
            // (audio session changes, app going to background, etc.).
            engine?.stoppedHandler = { [weak self] _ in
                self?.startEngine()
            }
            engine?.resetHandler = { [weak self] in
                self?.startEngine()
            }
            try engine?.start()
        } catch {
            print("[CoreHaptics] init failed: \(error)")
        }
    }

    private func startEngine() {
        guard let engine = engine else { return }
        do {
            try engine.start()
        } catch {
            print("[CoreHaptics] start failed: \(error)")
        }
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": supports])
    }

    // Any short pattern from JS (Nov 2026: "разные вибрации везде"):
    // events = [{ t: seconds, i: intensity 0..1, s: sharpness 0..1 }],
    // at most 16. JS builds pop / burst / sparkle / drum roll from it.
    @objc func play(_ call: CAPPluginCall) {
        let raw = call.getArray("events", JSObject.self) ?? []
        let events = raw.prefix(16).map { e in
            transientEvent(at: number(e["t"], 0), intensity: Float(number(e["i"], 0.5)), sharpness: Float(number(e["s"], 0.5)))
        }
        if !events.isEmpty { playPattern(Array(events)) }
        call.resolve()
    }

    private func number(_ v: JSValue?, _ fallback: Double) -> Double {
        if let n = v as? NSNumber { return n.doubleValue }
        if let d = v as? Double { return d }
        if let i = v as? Int { return Double(i) }
        return fallback
    }

    // --- Single-pulse shapes -----------------------------------------
    // intensity = how strong (0..1)
    // sharpness = how "crisp" / sudden (0..1) — low feels muted, high feels tap-like

    @objc func swipe(_ call: CAPPluginCall) {
        // Soft, low-sharpness pulse for swipe commit. Feels like a
        // smooth click rather than a jolt.
        playTransient(intensity: 0.45, sharpness: 0.4)
        call.resolve()
    }

    @objc func tap(_ call: CAPPluginCall) {
        // Crisp selection tick — for buttons, toggles, segmented controls.
        playTransient(intensity: 0.35, sharpness: 0.7)
        call.resolve()
    }

    @objc func medium(_ call: CAPPluginCall) {
        // Stronger thump — used as the "this matters" feedback (e.g.
        // committing a yes/no card swipe).
        playTransient(intensity: 0.7, sharpness: 0.55)
        call.resolve()
    }

    // --- Multi-pulse patterns ----------------------------------------

    @objc func success(_ call: CAPPluginCall) {
        let events = [
            transientEvent(at: 0.0, intensity: 0.5, sharpness: 0.55),
            transientEvent(at: 0.10, intensity: 0.8, sharpness: 0.7),
        ]
        playPattern(events)
        call.resolve()
    }

    @objc func warning(_ call: CAPPluginCall) {
        let events = [
            transientEvent(at: 0.0, intensity: 0.6, sharpness: 0.4),
            transientEvent(at: 0.16, intensity: 0.7, sharpness: 0.5),
        ]
        playPattern(events)
        call.resolve()
    }

    @objc func error(_ call: CAPPluginCall) {
        // Three sharp jabs — unmistakably "something went wrong".
        let events = [
            transientEvent(at: 0.0, intensity: 0.7, sharpness: 0.7),
            transientEvent(at: 0.08, intensity: 0.7, sharpness: 0.7),
            transientEvent(at: 0.16, intensity: 0.7, sharpness: 0.7),
        ]
        playPattern(events)
        call.resolve()
    }

    // --- Helpers ------------------------------------------------------

    private func transientEvent(at relativeTime: TimeInterval, intensity: Float, sharpness: Float) -> CHHapticEvent {
        return CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness),
            ],
            relativeTime: relativeTime
        )
    }

    private func playTransient(intensity: Float, sharpness: Float) {
        playPattern([transientEvent(at: 0, intensity: intensity, sharpness: sharpness)])
    }

    private func playPattern(_ events: [CHHapticEvent]) {
        guard supports, let engine = engine else { return }
        do {
            // Re-start defensively — if iOS stopped the engine while we
            // weren't looking, makePlayer would throw.
            try engine.start()
            let pattern = try CHHapticPattern(events: events, parameters: [])
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: 0)
        } catch {
            print("[CoreHaptics] play failed: \(error)")
        }
    }
}

// MARK: - Speech dictation plugin
//
// Her ask (Nov 2 2026): tap the mic in a note and just speak; no
// "use the keyboard's microphone" hint. Plain speech-to-text with
// SFSpeechRecognizer, on the device whenever the language allows it.
// No AI, nothing stored: the words go straight into the note's text.
// Same pattern as CoreHapticsPlugin above (class in this file, name
// injected into packageClassList by codemagic.yaml after cap sync).
// JS side: src/lib/speech.ts.

@objc(SpeechDictationPlugin)
public class SpeechDictationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechDictationPlugin"
    public let jsName = "SpeechDictation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var tapInstalled = false

    @objc func isAvailable(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "en-US"
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: lang))
        call.resolve(["available": recognizer?.isAvailable ?? false])
    }

    // Asks for speech recognition, then the microphone (two system prompts
    // the first time; afterwards it just answers).
    @objc func requestAccess(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else {
                DispatchQueue.main.async { call.resolve(["granted": false]) }
                return
            }
            AVAudioSession.sharedInstance().requestRecordPermission { ok in
                DispatchQueue.main.async { call.resolve(["granted": ok]) }
            }
        }
    }

    // Listens until stop(); sends the words so far as "partial" events
    // ({ text }) and "end" when it stops by itself.
    @objc func start(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "en-US"
        DispatchQueue.main.async {
            self.finish()
            guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: lang)), recognizer.isAvailable else {
                call.reject("unavailable")
                return
            }
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.record, mode: .measurement, options: .duckOthers)
                try session.setActive(true, options: .notifyOthersOnDeactivation)

                let req = SFSpeechAudioBufferRecognitionRequest()
                req.shouldReportPartialResults = true
                if recognizer.supportsOnDeviceRecognition {
                    req.requiresOnDeviceRecognition = true
                }
                let input = self.audioEngine.inputNode
                let format = input.outputFormat(forBus: 0)
                guard format.sampleRate > 0 else {
                    self.finish()
                    call.reject("no microphone")
                    return
                }
                input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                    req.append(buffer)
                }
                self.tapInstalled = true
                self.request = req
                self.audioEngine.prepare()
                try self.audioEngine.start()

                self.task = recognizer.recognitionTask(with: req) { [weak self] result, error in
                    if let result = result {
                        self?.notifyListeners("partial", data: ["text": result.bestTranscription.formattedString])
                    }
                    if error != nil || (result?.isFinal ?? false) {
                        DispatchQueue.main.async {
                            self?.finish()
                            self?.notifyListeners("end", data: [:])
                        }
                    }
                }
                call.resolve()
            } catch {
                self.finish()
                call.reject("start failed")
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.finish()
            call.resolve()
        }
    }

    private func finish() {
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if tapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        request?.endAudio()
        task?.finish()
        request = nil
        task = nil
        let session = AVAudioSession.sharedInstance()
        try? session.setActive(false, options: .notifyOthersOnDeactivation)
        // back to the app's normal sound: left on "record", the bubbles stayed silent after speaking a thought
        try? session.setCategory(.ambient, mode: .default, options: [])
    }
}
