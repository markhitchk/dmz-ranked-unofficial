import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

/** Reproduces main/app/build.gradle's original DMZ artwork preparation. */
public class GenerateDmzArtwork {
    public static void main(String[] args) throws Exception {
        System.setProperty("java.awt.headless", "true");
        File assets = new File(args.length == 0 ? "assets" : args[0]);
        BufferedImage source = ImageIO.read(new File(assets, "dmz_ranked_logo.png"));
        if (source == null) throw new IllegalStateException("Invalid original DMZ logo PNG");
        BufferedImage logo = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < source.getHeight(); y++) {
            for (int x = 0; x < source.getWidth(); x++) {
                int argb = source.getRGB(x, y);
                int alpha = (argb >>> 24) & 0xff;
                int normalizedAlpha = alpha < 8 ? 0 : (alpha > 247 ? 255 : alpha);
                logo.setRGB(x, y, (normalizedAlpha << 24) | (argb & 0x00ffffff));
            }
        }
        write(assets, "dmz_ranked_logo_display.png", logo);
        write(assets, "dmz_launcher_foreground.png", canvas(logo, 360, null));
        write(assets, "dmz_launcher_icon.png", canvas(logo, 420, new Color(17, 17, 17, 255)));
    }

    private static BufferedImage canvas(BufferedImage logo, int artSize, Color background) {
        BufferedImage image = new BufferedImage(512, 512, BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = image.createGraphics();
        if (background != null) {
            graphics.setColor(background);
            graphics.fillRect(0, 0, 512, 512);
        }
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        double scale = Math.min(artSize / (double) logo.getWidth(), artSize / (double) logo.getHeight());
        int width = Math.max(1, (int) Math.round(logo.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(logo.getHeight() * scale));
        graphics.drawImage(logo, (512 - width) / 2, (512 - height) / 2, width, height, null);
        graphics.dispose();
        return image;
    }

    private static void write(File assets, String name, BufferedImage image) throws Exception {
        if (!ImageIO.write(image, "png", new File(assets, name))) {
            throw new IllegalStateException("Could not write " + name);
        }
    }
}
