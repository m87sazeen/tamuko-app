// Barcode scanner sheet (camera). Used at the till and when adding products.
// Reads EAN/UPC (retail barcodes), Code 128/39 and QR codes. Asks for camera permission the first time.
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef } from 'react';
import { View } from 'react-native';
import { Button, Note, Sheet, Txt } from './ui';

export function Scanner({ visible, onClose, onCode, title = 'Scan barcode' }: { visible: boolean; onClose: () => void; onCode: (code: string) => void; title?: string }) {
  const [perm, ask] = useCameraPermissions();
  const last = useRef<{ code: string; at: number } | null>(null);

  const onScan = ({ data }: { data: string }) => {
    const now = Date.now();
    // Ignore the same code read again within 1.5 s (cameras report many frames per second).
    if (last.current && last.current.code === data && now - last.current.at < 1500) return;
    last.current = { code: data, at: now };
    onCode(data.trim());
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {!perm ? null : !perm.granted ? (
        <>
          <Note tone="info" text="tamuko uses the camera only to read barcodes. Nothing is recorded or uploaded." />
          {perm.canAskAgain ? <Button label="Allow camera" icon="search" onPress={ask} /> : <Note tone="warning" text="Camera access is off. Turn it on for tamuko in the phone’s Settings." />}
        </>
      ) : (
        <View style={{ height: 320, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000' }}>
          {visible && (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
              onBarcodeScanned={onScan}
            />
          )}
        </View>
      )}
      <Txt size={13} dim center>Hold the barcode inside the frame. Each scan adds one.</Txt>
      <Button kind="outline" label="Done" onPress={onClose} />
    </Sheet>
  );
}
