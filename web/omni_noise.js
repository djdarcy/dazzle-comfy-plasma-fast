/**
 * OmniNoise Widget Visibility Manager
 *
 * Dynamically shows/hides type-specific parameters based on noise type selection:
 * - turbulence: visible only for Plasma noise
 * - random_distribution: visible only for Random noise
 *
 * COMPATIBILITY NOTE:
 * Uses dynamic imports with auto-depth detection to work in both:
 * - Standalone mode: /extensions/dazzle-comfy-plasma-fast/
 * - DazzleNodes mode: /extensions/DazzleNodes/dazzle-comfy-plasma-fast/
 */

// Dynamic import helper for standalone vs DazzleNodes compatibility
async function importComfyApp() {
    const currentPath = import.meta.url;
    const urlParts = new URL(currentPath).pathname.split('/').filter(p => p);
    const depth = urlParts.length;
    const prefix = '../'.repeat(depth);

    const appModule = await import(`${prefix}scripts/app.js`);
    return appModule.app;
}

// Initialize extension with dynamic imports
(async () => {
    const app = await importComfyApp();

    // Add method to node prototype
    app.registerExtension({
    name: "dazzle.plasma.omni.methods",
    nodeCreated(node) {
        if (node.comfyClass !== "JDC_OmniNoise") return;

        // Store references to conditional widgets
        node.conditionalWidgets = {
            turbulence: node.widgets.find(w => w.name === "turbulence"),
            random_distribution: node.widgets.find(w => w.name === "random_distribution")
        };

        // Store widget values for preservation
        node.conditionalWidgetValues = {
            turbulence: 2.75,
            random_distribution: "Uniform (TV Static)"
        };

        /**
         * Update visibility of conditional widgets based on noise type
         */
        node.updateConditionalVisibility = function() {
            const noiseTypeWidget = this.widgets.find(w => w.name === "noise_type");
            if (!noiseTypeWidget) return;

            const noiseType = noiseTypeWidget.value;
            const noiseTypeIndex = this.widgets.indexOf(noiseTypeWidget);

            // Determine which widgets should be visible
            const shouldShowTurbulence = (noiseType === "Plasma");
            const shouldShowRandomDist = (noiseType === "Random");

            // Get current visibility state
            const turbulenceIndex = this.widgets.indexOf(this.conditionalWidgets.turbulence);
            const randomDistIndex = this.widgets.indexOf(this.conditionalWidgets.random_distribution);

            const turbulenceVisible = (turbulenceIndex !== -1);
            const randomDistVisible = (randomDistIndex !== -1);

            // Track insertion position (right after noise_type)
            let currentIndex = noiseTypeIndex + 1;

            // Process random_distribution (show/hide)
            if (shouldShowRandomDist && !randomDistVisible) {
                // SHOW random_distribution
                if (this.conditionalWidgetValues.random_distribution !== undefined) {
                    this.conditionalWidgets.random_distribution.value = this.conditionalWidgetValues.random_distribution;
                }
                this.widgets.splice(currentIndex, 0, this.conditionalWidgets.random_distribution);
                currentIndex++;  // Move insertion point forward
            } else if (shouldShowRandomDist && randomDistVisible) {
                // Already visible, update currentIndex
                if (randomDistIndex >= currentIndex) {
                    currentIndex = randomDistIndex + 1;
                }
            } else if (!shouldShowRandomDist && randomDistVisible) {
                // HIDE random_distribution
                this.conditionalWidgetValues.random_distribution = this.conditionalWidgets.random_distribution.value;
                this.widgets.splice(randomDistIndex, 1);
            }

            // Recalculate turbulence index after potential random_distribution changes
            const turbulenceIndexAfter = this.widgets.indexOf(this.conditionalWidgets.turbulence);
            const turbulenceVisibleAfter = (turbulenceIndexAfter !== -1);

            // Process turbulence (show/hide)
            if (shouldShowTurbulence && !turbulenceVisibleAfter) {
                // SHOW turbulence
                if (this.conditionalWidgetValues.turbulence !== undefined) {
                    this.conditionalWidgets.turbulence.value = this.conditionalWidgetValues.turbulence;
                }
                this.widgets.splice(currentIndex, 0, this.conditionalWidgets.turbulence);
            } else if (!shouldShowTurbulence && turbulenceVisibleAfter) {
                // HIDE turbulence
                this.conditionalWidgetValues.turbulence = this.conditionalWidgets.turbulence.value;
                const finalTurbulenceIndex = this.widgets.indexOf(this.conditionalWidgets.turbulence);
                this.widgets.splice(finalTurbulenceIndex, 1);
            }

            // Resize node to accommodate changes
            const currentSize = this.size || this.computeSize();
            const newSize = this.computeSize();
            this.setSize([currentSize[0], newSize[1]]);
        };

        // Hook into noise_type widget callback
        const noiseTypeWidget = node.widgets.find(w => w.name === "noise_type");
        if (noiseTypeWidget) {
            const originalCallback = noiseTypeWidget.callback;
            noiseTypeWidget.callback = function(value) {
                if (originalCallback) {
                    originalCallback.apply(this, arguments);
                }
                // Trigger visibility update when noise type changes
                node.updateConditionalVisibility();
            };
        }

        // Set initial state (after a brief delay to ensure widgets are fully initialized)
        setTimeout(() => {
            node.updateConditionalVisibility();
        }, 100);
    }
    });
})();
