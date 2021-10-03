
class App {
    // should use comlink now!

    constructor() {
        // initialize GRID
        // items are draggable
        var grid = new Muuri('.grid', {
            dragEnabled: true,
            dragHandle: ".item-content"
        });

        // resize grid when elements changed
        function resizeItem(item, width, height) {
            var el = item.getElement();
            var grid = item.getGrid();
            el.style.width = width + 'px';
            el.style.height = height + 'px';
            el.children[0].style.width = width + 'px';
            el.children[0].style.height = height + 'px';
            grid.refreshItems(item);
            grid.layout();
        }

        // resize layout when window size changes
        window.addEventListener('resize', (e) => {
            grid.refreshItems().layout();
        });

        // resize layout when each item size changes
        // should respond to resize events on the bottom right corner
        document.querySelectorAll(".item").forEach(elem => {
            new ResizeObserver(() => {
                grid.refreshItems().layout();
            }).observe(elem);
        })

        // test, double click on the element and it should resize
        document.addEventListener('dblclick', (e) => {
            var itemElement = e.target.closest('.item');
            if (!itemElement) return;

            var item = grid.getItems(itemElement)[0];
            if (!item) return;

            resizeItem(item, item._width, item._height === 200 ? 410 : 200);
        });

        // ACCORDION JS
        document.querySelectorAll(".accordion").forEach(elem => {
            elem.addEventListener("click", function () {
                this.classList.toggle("active");

                // show/hide panel
                var panel = this.nextElementSibling;
                if (panel.style.display === "block") {
                    panel.style.display = "none";
                } else {
                    panel.style.display = "block";
                }

                // set height to panel
                if (panel.style.maxHeight) {
                    panel.style.maxHeight = null;
                  } else {
                    panel.style.maxHeight = panel.scrollHeight + "px";
                  }
            });
        })
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.app = new App();
});
