(function ($, Drupal, BUE) {
'use strict';

/**
 * @file
 * Defines BUEditor as a Drupal editor.
 */

/**
 * Define editor methods.
 */
if (Drupal.editors) Drupal.editors.bueditor = {
  attach: function (element, format) {
    var settings = format.editorSettings;
    if (settings) {
      // Set format
      if (!settings.inputFormat) {
        settings.inputFormat = format.format;
      }
      return BUE.attach(element, settings);
    }
  },
  detach: function (element, format, trigger) {
    return BUE.detach(element);
  },
  onChange: function (element, callback) {
  },
};

})(jQuery, Drupal, BUE);
