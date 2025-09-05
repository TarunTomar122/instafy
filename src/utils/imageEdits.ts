import { removeBackground as imglyRemoveBackground, preload } from "@imgly/background-removal";

// Optionally preload assets for faster first use
preload().catch(console.error);

export const removeBackground = async (image: string) => {
    try {
        const blob = await imglyRemoveBackground(image, { debug: true });
        const url = URL.createObjectURL(blob);
        return url;
    } catch (error) {
        console.error("Background removal failed:", error);
        throw error;
    }
};