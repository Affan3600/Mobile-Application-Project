import { useWindowDimensions } from 'react-native';

/** Window size follows the device's physical orientation, so layouts re-flow on rotate. */
export function useOrientation() {
  const { width, height } = useWindowDimensions();
  return { width, height, isLandscape: width > height };
}
