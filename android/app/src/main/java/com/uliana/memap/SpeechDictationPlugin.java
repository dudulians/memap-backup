package com.uliana.memap;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

/**
 * Speaking a note (her ask, Nov 2 2026): tap the mic and just speak.
 * Plain speech-to-text with Android's SpeechRecognizer, offline when the
 * phone can. No AI, nothing stored. Same API as the iOS plugin in
 * AppDelegate.swift; JS side: src/lib/speech.ts.
 */
@CapacitorPlugin(
    name = "SpeechDictation",
    permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class SpeechDictationPlugin extends Plugin {
    private SpeechRecognizer recognizer;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            granted(call, true);
            return;
        }
        requestPermissionForAlias("microphone", call, "accessCallback");
    }

    @PermissionCallback
    private void accessCallback(PluginCall call) {
        granted(call, getPermissionState("microphone") == PermissionState.GRANTED);
    }

    private void granted(PluginCall call, boolean ok) {
        JSObject r = new JSObject();
        r.put("granted", ok);
        call.resolve(r);
    }

    @PluginMethod
    public void start(final PluginCall call) {
        final String lang = call.getString("lang", "en-US");
        getActivity().runOnUiThread(() -> {
            finish();
            if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                call.reject("unavailable");
                return;
            }
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) {}
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float rmsdB) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() {}
                @Override public void onError(int error) { ended(); }
                @Override public void onResults(Bundle results) { send(results); ended(); }
                @Override public void onPartialResults(Bundle partialResults) { send(partialResults); }
                @Override public void onEvent(int eventType, Bundle params) {}
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
            recognizer.startListening(intent);
            call.resolve();
        });
    }

    @PluginMethod
    public void stop(final PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (recognizer != null) recognizer.stopListening();
            call.resolve();
        });
    }

    private void send(Bundle bundle) {
        ArrayList<String> said = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (said == null || said.isEmpty()) return;
        JSObject data = new JSObject();
        data.put("text", said.get(0));
        notifyListeners("partial", data);
    }

    private void ended() {
        finish();
        notifyListeners("end", new JSObject());
    }

    private void finish() {
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        finish();
    }
}
