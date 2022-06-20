/**
 * @file
 * Enables syntax highlighting via HighlightJS on the HTML code tag.
 */

(function ($, Drupal) {
  'use strict';

  Drupal.behaviors.codesnippet = {
    attach: function () {
      $('pre code').each(function (i, e) {
        hljs.highlightBlock(e);
      });
    }
  };

})(jQuery, Drupal);
