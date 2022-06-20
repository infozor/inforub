(function($, BUE, Editor) {
'use strict';

/**
 * @file
 * Defines editor popup management.
 */

/**
 * Editor popups builder.
 */
BUE.buildEditorPopups = function(E) {
  E.popups = {};
  E.bind('destroy', BUE.destroyEditorPopups);
};

/**
 * Editor popups destroyer.
 */
BUE.destroyEditorPopups = function(E) {
  for (var i in E.popups) {
    E.popups[i].destroy();
  }
  delete E.popups;
};

/**
 * Creates an editor popup.
 */
Editor.createPopup = function(name, title, content, opt) {
  var Popup = this.popups[name];
  if (!Popup) {
    opt = BUE.extend({name: name, Editor: this}, opt);
    Popup = this.popups[name] = new BUE.Popup(title, content, opt);
  }
  return Popup;
};

/**
 * Returns an editor popup.
 */
Editor.getPopup = function(name) {
  return this.popups[name];
};

/**
 * Removes an editor popup.
 */
Editor.removePopup = function(Popup) {
  if (typeof Popup === 'string') {
    Popup = this.getPopup(Popup);
  }
  if (Popup && Popup.Editor === this) {
    Popup.close();
    delete this.popups[Popup.name];
    delete Popup.Editor;
    BUE.removeEl(Popup.el);
  }
};

/**
 * Creates an editor dialog.
 */
Editor.createDialog = function(name, title, content, opt) {
  opt = BUE.extend({type: 'dialog'}, opt);
  return this.createPopup(name, title, content, opt);
};

/**
 * Creates and opens a tag dialog.
 */
Editor.tagDialog = function(tag, fields, opt) {
  var Popup = this.getTagDialog(tag) || this.createTagDialog(tag, fields, opt);
  return Popup.open();
};

/**
 * Creates a tag dialog.
 */
Editor.createTagDialog = function(tag, fields, opt) {
  var name, Popup, title, content;
  // Allow opt to be the title.
  opt = typeof opt === 'string' ? {title: opt} : opt || {};
  // Prepare dialog name. Allow a custom name(for multiple dialogs of the same tag)
  name = opt.name || tag + '-tag-dialog';
  if (Popup = this.getPopup(name)) {
    return Popup;
  }
  // Create the form and the dialog
  title = opt.title || BUE.t('Tag editor - @tag', {'@tag': tag.toUpperCase()});
  content = BUE.createTagForm(tag, fields, opt);
  Popup = this.createDialog(name, title, content, {tag: tag});
  Popup.bind('open', BUE.tagDialogOnOpen);
  return Popup;
};

/**
 * Returns a tag dialog.
 */
Editor.getTagDialog = function(tag) {
  return this.getPopup(tag + '-tag-dialog');
};

/**
 * Creates and opens the tag chooser popup.
 */
Editor.tagChooser = function(tagData, opt) {
  var name = 'tag-chooser', Popup = this.getPopup(name);
  if (!Popup) {
    Popup = this.createPopup(name, null, null, {type: 'quick'});
  }
  Popup.setContent(BUE.createTagChooserEl(tagData, opt));
  return Popup.open();
};

/**
 * Returns the initial position of a popup with respect to editor UI.
 */
Editor.defaultPopupPosition = function(Popup) {
  var left, top, buttonPos, buttonEl, popupWidth, diff, Button = this.lastFiredButton;
  if (!Button) {
    return $(this.textarea).offset();
  }
  buttonEl = Button.el;
  buttonPos = $(buttonEl).offset();
  popupWidth = Popup.el.offsetWidth || 50;
  left = buttonPos.left - popupWidth/2 + buttonEl.offsetWidth/2;
  top = buttonPos.top + buttonEl.offsetHeight;
  // Check right boundary
  diff = (left + popupWidth) - (window.innerWidth || document.documentElement.clientWidth);
  if (diff > 0) left -= diff;
  return {left: Math.max(10, left), top: top};
};

/**
 * Open handler of tag dialog.
 */
BUE.tagDialogOnOpen = function(Popup) {
  var i, el, selection, htmlObj, values, form = Popup.getForm();    
  // Reset the fields to initial values.
  form.reset();
  // Populate fields using the current selection.
  if (selection = Popup.Editor.getSelection()) {
    if (htmlObj = BUE.parseHtml(selection, Popup.tag)) {
      values = htmlObj.attributes;
      values.html = htmlObj.html || '';
    }
    else {
      values = {html: selection};
    }
    for (i in values) {
      if (el = form.elements[i]) {
        el.value = values[i];
      }
    }
  }
};


})(jQuery, BUE, BUE.Editor.prototype);