package com.kuberbassi.savewave;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SavewaveMediaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
