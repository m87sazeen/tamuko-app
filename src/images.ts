// Pick a square image (logo, payment QR) from the photo library, resized and returned as a PNG data URI.
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export async function pickImage(size: number): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [1, 1] });
  if (r.canceled) return null;
  const out = await ImageManipulator.manipulateAsync(r.assets[0].uri, [{ resize: { width: size } }], { compress: 0.8, format: ImageManipulator.SaveFormat.PNG, base64: true });
  return out.base64 ? `data:image/png;base64,${out.base64}` : null;
}
