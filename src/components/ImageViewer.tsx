/**
 * Full-screen image viewer with pinch-to-zoom.
 *
 * Usage:
 *   const [viewerUri, setViewerUri] = useState<string | null>(null);
 *   <ImageViewer visible={!!viewerUri} imageUri={viewerUri ?? ''} onClose={() => setViewerUri(null)} />
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Zoomable } from '@likashefqet/react-native-image-zoom';
import { Image } from 'react-native';
import { CloseIcon } from '../theme/icons';
import { colors } from '../theme';

const VIEWER_BG = colors.camera; // full-black for image viewing
const CLOSE_BTN_BG = colors.overlay; // semi-transparent dark

interface ImageViewerProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
}

export function ImageViewer({ visible, imageUri, onClose }: ImageViewerProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
      <View style={styles.backdrop}>
        <Zoomable
          minScale={1}
          maxScale={5}
          doubleTapScale={2}
          style={styles.zoomable}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel="Full-screen image"
          />
        </Zoomable>

        <Pressable
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <CloseIcon size={24} color={colors.white} />
        </Pressable>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: VIEWER_BG,
  },
  zoomable: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CLOSE_BTN_BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
