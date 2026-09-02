package com.mimusica.player;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.documentfile.provider.DocumentFile;
import com.getcapacitor.BridgeActivity;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static final int RQS_OPEN_DOCUMENT_TREE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = (WebView) this.bridge.getWebView();
        webView.getSettings().setJavaScriptEnabled(true);
        // Exponer la interfaz Java nativa hacia el Javascript de la app
        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidHost");
    }

    public class WebAppInterface {
        Activity mActivity;

        WebAppInterface(Activity activity) {
            mActivity = activity;
        }

        @JavascriptInterface
        public void openFolderPicker() {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
            mActivity.startActivityForResult(intent, RQS_OPEN_DOCUMENT_TREE);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == RQS_OPEN_DOCUMENT_TREE && resultCode == RESULT_OK && data != null) {
            Uri treeUri = data.getData();
            if (treeUri != null) {
                // Dar permisos persistentes a la carpeta seleccionada
                getContentResolver().takePersistableUriPermission(
                    treeUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                );

                // Escanear la estructura de la carpeta en un hilo secundario
                new Thread(() -> {
                    try {
                        DocumentFile pickedDir = DocumentFile.fromTreeUri(this, treeUri);
                        JSONArray resultAlbums = new JSONArray();

                        if (pickedDir != null && pickedDir.isDirectory()) {
                            for (DocumentFile file : pickedDir.listFiles()) {
                                // Si es una subcarpeta (Álbum)
                                if (file.isDirectory()) {
                                    JSONObject albumObj = new JSONObject();
                                    albumObj.put("name", file.getName());

                                    JSONArray tracksArray = new JSONArray();
                                    String coverUri = "";

                                    for (DocumentFile subFile : file.listFiles()) {
                                        String name = subFile.getName();
                                        if (name != null) {
                                            if (name.toLowerCase().startsWith("cover.")) {
                                                coverUri = subFile.getUri().toString();
                                            } else if (name.matches("(?i).*\\.(mp3|wav|m4a|ogg|flac)$")) {
                                                JSONObject trackObj = new JSONObject();
                                                trackObj.put("title", name.replaceAll("(?i)\\.[^/.]+$", ""));
                                                trackObj.put("src", subFile.getUri().toString());
                                                tracksArray.put(trackObj);
                                            }
                                        }
                                    }

                                    if (tracksArray.length() > 0) {
                                        albumObj.put("cover", coverUri);
                                        albumObj.put("tracks", tracksArray);
                                        resultAlbums.put(albumObj);
                                    }
                                }
                            }
                        }

                        // Enviar los datos escaneados a app.js
                        String jsonString = resultAlbums.toString();
                        runOnUiThread(() -> {
                            WebView webView = (WebView) bridge.getWebView();
                            webView.evaluateJavascript("window.onFolderSelected(" + jsonString + ");", null);
                        });

                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }).start();
            }
        }
    }
}
