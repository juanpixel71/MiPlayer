package com.mimusica.player;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    public static final String CHANNEL_ID =
            "media_playback_channel";

    private static final int MEDIA_PERMISSION_REQUEST =
            1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);

        createNotificationChannel();

        requestMediaPermissions();
    }

    // =========================================
    // PERMISOS PARA AUDIO E IMÁGENES
    // =========================================

    private void requestMediaPermissions() {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {

            boolean audioGranted =
                    ContextCompat.checkSelfPermission(
                            this,
                            Manifest.permission.READ_MEDIA_AUDIO
                    ) == PackageManager.PERMISSION_GRANTED;

            boolean imagesGranted =
                    ContextCompat.checkSelfPermission(
                            this,
                            Manifest.permission.READ_MEDIA_IMAGES
                    ) == PackageManager.PERMISSION_GRANTED;

            if (!audioGranted || !imagesGranted) {

                ActivityCompat.requestPermissions(
                        this,
                        new String[] {
                                Manifest.permission.READ_MEDIA_AUDIO,
                                Manifest.permission.READ_MEDIA_IMAGES
                        },
                        MEDIA_PERMISSION_REQUEST
                );
            }

        } else {

            boolean storageGranted =
                    ContextCompat.checkSelfPermission(
                            this,
                            Manifest.permission.READ_EXTERNAL_STORAGE
                    ) == PackageManager.PERMISSION_GRANTED;

            if (!storageGranted) {

                ActivityCompat.requestPermissions(
                        this,
                        new String[] {
                                Manifest.permission.READ_EXTERNAL_STORAGE
                        },
                        MEDIA_PERMISSION_REQUEST
                );
            }
        }
    }

    // =========================================
    // CANAL DE NOTIFICACIONES
    // =========================================

    private void createNotificationChannel() {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            CharSequence name =
                    "Reproductor de Música";

            String description =
                    "Controles de reproducción en segundo plano y pantalla de bloqueo";

            int importance =
                    NotificationManager.IMPORTANCE_LOW;

            NotificationChannel channel =
                    new NotificationChannel(
                            CHANNEL_ID,
                            name,
                            importance
                    );

            channel.setDescription(
                    description
            );

            NotificationManager notificationManager =
                    getSystemService(
                            NotificationManager.class
                    );

            if (notificationManager != null) {

                notificationManager.createNotificationChannel(
                        channel
                );
            }
        }
    }
}
