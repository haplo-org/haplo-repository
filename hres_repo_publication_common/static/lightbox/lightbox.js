
// --------------------------------------------------------------------------
// --- enable lightbox
if(window.jQuery && jQuery(document).featherlightGallery) {
    jQuery(".haplo-repository-images-widget").featherlightGallery({
        filter: 'a.haplo-repository-images-widget-image',
        contentFilters: ["image"]
    });
    jQuery(".haplo-images-container").each(function() {
        if(this.offsetHeight > 230) {
            this.style.height="160px";
            var widget = jQuery(this).parents('.haplo-repository-images-widget');
            jQuery(".haplo-images-show-more", widget).show();
            jQuery(".haplo-images-show-more-button", widget).on('click', function(evt) {
                evt.preventDefault();
                jQuery(".haplo-images-container", widget)[0].style.height="";
                jQuery(".haplo-images-show-more-button", widget).hide();
            });
        }
    });
}
