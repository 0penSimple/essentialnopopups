import { encode as encodeBmp } from '@stacksjs/ts-bmp';
import { FaviconComposer } from 'favium';
window.ImageEncoders = {
  bmp(imageData) {
    return encodeBmp(imageData, { bitsPerPixel: 32 });
  },
  ico(canvas, sizes) {
    return new FaviconComposer(canvas).ico(sizes);
  }
};
