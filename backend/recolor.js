const Jimp = require('jimp');

async function recolor() {
  const imagePath = '../frontend/assets/icon/app_icon.png';
  const newImagePath = '../frontend/assets/icon/app_icon_maroon.png';
  
  try {
    const img = await Jimp.read(imagePath);
    
    // Get top-left color as background
    const bgColor = img.getPixelColor(0, 0);
    const { r: br, g: bg, b: bb, a: ba } = Jimp.intToRGBA(bgColor);
    
    img.scan(0, 0, img.bitmap.width, img.bitmap.height, function(x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      const dist = Math.sqrt(Math.pow(r - br, 2) + Math.pow(g - bg, 2) + Math.pow(b - bb, 2));
      
      // If within tolerance of the pinkish background, change to maroon #8B1C28
      if (dist < 50) {
        this.bitmap.data[idx + 0] = 139;
        this.bitmap.data[idx + 1] = 28;
        this.bitmap.data[idx + 2] = 40;
      }
    });

    await img.writeAsync(newImagePath);
    console.log('Recolored app_icon.png to app_icon_maroon.png successfully.');
  } catch (e) {
    console.error('Error recoloring: ', e);
  }
}
recolor();
