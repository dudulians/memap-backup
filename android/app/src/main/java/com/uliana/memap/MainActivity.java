package com.uliana.memap;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Our own plugins (not from npm) register before the bridge starts.
        registerPlugin(SpeechDictationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
