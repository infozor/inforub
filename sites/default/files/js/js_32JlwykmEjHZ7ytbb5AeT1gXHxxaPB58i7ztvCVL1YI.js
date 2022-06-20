window.matchMedia||(window.matchMedia=function(){"use strict";var e=window.styleMedia||window.media;if(!e){var t=document.createElement("style"),i=document.getElementsByTagName("script")[0],n=null;t.type="text/css";t.id="matchmediajs-test";i.parentNode.insertBefore(t,i);n="getComputedStyle"in window&&window.getComputedStyle(t,null)||t.currentStyle;e={matchMedium:function(e){var i="@media "+e+"{ #matchmediajs-test { width: 1px; } }";if(t.styleSheet){t.styleSheet.cssText=i}else{t.textContent=i}return n.width==="1px"}}}return function(t){return{matches:e.matchMedium(t||"all"),media:t||"all"}}}());
;
/**
 * @file
 * CKEditor implementation of {@link Drupal.editors} API.
 */

(function (Drupal, debounce, CKEDITOR, $) {

  'use strict';

  /**
   * @namespace
   */
  Drupal.editors.ckeditor = {

    /**
     * Editor attach callback.
     *
     * @param {HTMLElement} element
     *   The element to attach the editor to.
     * @param {string} format
     *   The text format for the editor.
     *
     * @return {bool}
     *   Whether the call to `CKEDITOR.replace()` created an editor or not.
     */
    attach: function (element, format) {
      this._loadExternalPlugins(format);
      // Also pass settings that are Drupal-specific.
      format.editorSettings.drupal = {
        format: format.format
      };

      // Set a title on the CKEditor instance that includes the text field's
      // label so that screen readers say something that is understandable
      // for end users.
      var label = $('label[for=' + element.getAttribute('id') + ']').html();
      format.editorSettings.title = Drupal.t('Rich Text Editor, !label field', {'!label': label});

      return !!CKEDITOR.replace(element, format.editorSettings);
    },

    /**
     * Editor detach callback.
     *
     * @param {HTMLElement} element
     *   The element to detach the editor from.
     * @param {string} format
     *   The text format used for the editor.
     * @param {string} trigger
     *   The event trigger for the detach.
     *
     * @return {bool}
     *   Whether the call to `CKEDITOR.dom.element.get(element).getEditor()`
     *   found an editor or not.
     */
    detach: function (element, format, trigger) {
      var editor = CKEDITOR.dom.element.get(element).getEditor();
      if (editor) {
        if (trigger === 'serialize') {
          editor.updateElement();
        }
        else {
          editor.destroy();
          element.removeAttribute('contentEditable');
        }
      }
      return !!editor;
    },

    /**
     * Reacts on a change in the editor element.
     *
     * @param {HTMLElement} element
     *   The element where the change occured.
     * @param {function} callback
     *   Callback called with the value of the editor.
     *
     * @return {bool}
     *   Whether the call to `CKEDITOR.dom.element.get(element).getEditor()`
     *   found an editor or not.
     */
    onChange: function (element, callback) {
      var editor = CKEDITOR.dom.element.get(element).getEditor();
      if (editor) {
        editor.on('change', debounce(function () {
          callback(editor.getData());
        }, 400));
      }
      return !!editor;
    },

    /**
     * Attaches an inline editor to a DOM element.
     *
     * @param {HTMLElement} element
     *   The element to attach the editor to.
     * @param {object} format
     *   The text format used in the editor.
     * @param {string} [mainToolbarId]
     *   The id attribute for the main editor toolbar, if any.
     * @param {string} [floatedToolbarId]
     *   The id attribute for the floated editor toolbar, if any.
     *
     * @return {bool}
     *   Whether the call to `CKEDITOR.replace()` created an editor or not.
     */
    attachInlineEditor: function (element, format, mainToolbarId, floatedToolbarId) {
      this._loadExternalPlugins(format);
      // Also pass settings that are Drupal-specific.
      format.editorSettings.drupal = {
        format: format.format
      };

      var settings = $.extend(true, {}, format.editorSettings);

      // If a toolbar is already provided for "true WYSIWYG" (in-place editing),
      // then use that toolbar instead: override the default settings to render
      // CKEditor UI's top toolbar into mainToolbar, and don't render the bottom
      // toolbar at all. (CKEditor doesn't need a floated toolbar.)
      if (mainToolbarId) {
        var settingsOverride = {
          extraPlugins: 'sharedspace',
          removePlugins: 'floatingspace,elementspath',
          sharedSpaces: {
            top: mainToolbarId
          }
        };

        // Find the "Source" button, if any, and replace it with "Sourcedialog".
        // (The 'sourcearea' plugin only works in CKEditor's iframe mode.)
        var sourceButtonFound = false;
        for (var i = 0; !sourceButtonFound && i < settings.toolbar.length; i++) {
          if (settings.toolbar[i] !== '/') {
            for (var j = 0; !sourceButtonFound && j < settings.toolbar[i].items.length; j++) {
              if (settings.toolbar[i].items[j] === 'Source') {
                sourceButtonFound = true;
                // Swap sourcearea's "Source" button for sourcedialog's.
                settings.toolbar[i].items[j] = 'Sourcedialog';
                settingsOverride.extraPlugins += ',sourcedialog';
                settingsOverride.removePlugins += ',sourcearea';
              }
            }
          }
        }

        settings.extraPlugins += ',' + settingsOverride.extraPlugins;
        settings.removePlugins += ',' + settingsOverride.removePlugins;
        settings.sharedSpaces = settingsOverride.sharedSpaces;
      }

      // CKEditor requires an element to already have the contentEditable
      // attribute set to "true", otherwise it won't attach an inline editor.
      element.setAttribute('contentEditable', 'true');

      return !!CKEDITOR.inline(element, settings);
    },

    /**
     * Loads the required external plugins for the editor.
     *
     * @param {object} format
     *   The text format used in the editor.
     */
    _loadExternalPlugins: function (format) {
      var externalPlugins = format.editorSettings.drupalExternalPlugins;
      // Register and load additional CKEditor plugins as necessary.
      if (externalPlugins) {
        for (var pluginName in externalPlugins) {
          if (externalPlugins.hasOwnProperty(pluginName)) {
            CKEDITOR.plugins.addExternal(pluginName, externalPlugins[pluginName], '');
          }
        }
        delete format.editorSettings.drupalExternalPlugins;
      }
    }

  };

  Drupal.ckeditor = {

    /**
     * Variable storing the current dialog's save callback.
     *
     * @type {?function}
     */
    saveCallback: null,

    /**
     * Open a dialog for a Drupal-based plugin.
     *
     * This dynamically loads jQuery UI (if necessary) using the Drupal AJAX
     * framework, then opens a dialog at the specified Drupal path.
     *
     * @param {CKEditor} editor
     *   The CKEditor instance that is opening the dialog.
     * @param {string} url
     *   The URL that contains the contents of the dialog.
     * @param {object} existingValues
     *   Existing values that will be sent via POST to the url for the dialog
     *   contents.
     * @param {function} saveCallback
     *   A function to be called upon saving the dialog.
     * @param {object} dialogSettings
     *   An object containing settings to be passed to the jQuery UI.
     */
    openDialog: function (editor, url, existingValues, saveCallback, dialogSettings) {
      // Locate a suitable place to display our loading indicator.
      var $target = $(editor.container.$);
      if (editor.elementMode === CKEDITOR.ELEMENT_MODE_REPLACE) {
        $target = $target.find('.cke_contents');
      }

      // Remove any previous loading indicator.
      $target.css('position', 'relative').find('.ckeditor-dialog-loading').remove();

      // Add a consistent dialog class.
      var classes = dialogSettings.dialogClass ? dialogSettings.dialogClass.split(' ') : [];
      classes.push('ui-dialog--narrow');
      dialogSettings.dialogClass = classes.join(' ');
      dialogSettings.autoResize = window.matchMedia('(min-width: 600px)').matches;
      dialogSettings.width = 'auto';

      // Add a "Loading…" message, hide it underneath the CKEditor toolbar,
      // create a Drupal.Ajax instance to load the dialog and trigger it.
      var $content = $('<div class="ckeditor-dialog-loading"><span style="top: -40px;" class="ckeditor-dialog-loading-link">' + Drupal.t('Loading...') + '</span></div>');
      $content.appendTo($target);

      var ckeditorAjaxDialog = Drupal.ajax({
        dialog: dialogSettings,
        dialogType: 'modal',
        selector: '.ckeditor-dialog-loading-link',
        url: url,
        progress: {type: 'throbber'},
        submit: {
          editor_object: existingValues
        }
      });
      ckeditorAjaxDialog.execute();

      // After a short delay, show "Loading…" message.
      window.setTimeout(function () {
        $content.find('span').animate({top: '0px'});
      }, 1000);

      // Store the save callback to be executed when this dialog is closed.
      Drupal.ckeditor.saveCallback = saveCallback;
    }
  };

  // Moves the dialog to the top of the CKEDITOR stack.
  $(window).on('dialogcreate', function (e, dialog, $element, settings) {
    $('.ui-dialog--narrow').css('zIndex', CKEDITOR.config.baseFloatZIndex + 1);
  });

  // Respond to new dialogs that are opened by CKEditor, closing the AJAX loader.
  $(window).on('dialog:beforecreate', function (e, dialog, $element, settings) {
    $('.ckeditor-dialog-loading').animate({top: '-40px'}, function () {
      $(this).remove();
    });
  });

  // Respond to dialogs that are saved, sending data back to CKEditor.
  $(window).on('editor:dialogsave', function (e, values) {
    if (Drupal.ckeditor.saveCallback) {
      Drupal.ckeditor.saveCallback(values);
    }
  });

  // Respond to dialogs that are closed, removing the current save handler.
  $(window).on('dialog:afterclose', function (e, dialog, $element) {
    if (Drupal.ckeditor.saveCallback) {
      Drupal.ckeditor.saveCallback = null;
    }
  });

  // Set the CKEditor cache-busting string to the same value as Drupal.
  CKEDITOR.timestamp = drupalSettings.ckeditor.timestamp;

})(Drupal, Drupal.debounce, CKEDITOR, jQuery);
;
(function(g,n,h,q){'use strict';var b=n.BUE=n.BUE||{editors:{},popups:{},buttonDefinitions:{},buttonRegistry:{},fileBrowsers:{},builders:{},protos:{},i18n:{},counter:0};g.fn.BUE=function(a){var c,d,f;if("get"===a)return(d=this[0])?b.editorOf(d):!1;f="detach"===a?b.detach:b.attach;for(c=0;d=this[c];c++)f(d,a);return this};b.attach=function(a,c){var d=b.editorOf(a);!d&&c&&(c.customButtons&&(b.defineRegisteredButtons(),b.addButtonDefinitions(c.customButtons),c.customButtons=null),d=new b.Editor(a,c));
return d};b.detach=function(a){(a=b.editorOf(a))&&a.destroy();return a};b.getEditor=function(a){return b.editors[a]};b.getPopup=function(a){return b.popups[a]};b.getButtonDefinition=function(a){b.definedRB||b.defineRegisteredButtons();return b.buttonDefinitions[a]};b.addButtonDefinition=function(a){if(a.id){var c=a.code?"code":a.template?"template":!1;c&&"string"===typeof a[c]&&"js:"===a[c].substr(0,3)&&(a[c]=new Function("E","$",a[c].substr(3)));return b.buttonDefinitions[a.id]=a}};b.addButtonDefinitions=
function(a){if(a)for(var c in a)b.addButtonDefinition(a[c])};b.registerButtons=function(a,c){b.buttonRegistry[a]=c;b.definedRB&&b.addButtonDefinitions(c())};b.defineRegisteredButtons=function(){if(!b.definedRB){var a,c=b.buttonRegistry;b.definedRB=!0;for(a in c)b.addButtonDefinitions(c[a]())}};b.t=function(a,c){var d,f,m,e=b.i18nHandlers;a=b.i18n[a]||a||"";if(c)for(d in e||(e=b.i18nHandlers={"@":b.plain,"%":b.emplain}),c){f=c[d];if(m=e[d.charAt(0)])f=m(f);a=a.replace(d,f)}return a};b.extend=function(a){var c,
b,f,m=arguments;a||(a={});for(c=1;c<m.length;c++)if(f=m[c])for(b in f)a[b]=f[b];return a};b.regesc=function(a){return a.replace(/([\\\^\$\*\+\?\.\(\)\[\]\{\}\|\:\-])/g,"\\$1")};b.delayError=function(a){setTimeout(function(){throw a;})};b.focusEl=function(a){try{a.focus()}catch(c){}};b.createForm=function(a,c){var d;d=b.formHtmlObj(a);c||(c={});b.extendAttr(d.attributes,c.attributes);d=b.buildCreateEl(d);d.onsubmit=b.eFormSubmit;g(d).data("options",c);return d};b.formHtmlObj=function(a){var c,d,f,
m,e="",g="",l=[];for(c=0;d=a[c];c++)if(m=b.fieldHtml(d),d.isAction)g+=m;else if("hidden"===d.type)e+=m;else{for(f=d;f.getnext;)if(f=a[++c])m+=b.fieldHtml(f);else break;l.push(b.fieldRowHtml(d,m))}g&&(g='<div class="bue-form-actions">'+g+"</div>");l=b.fieldRowsHtml(l);return{tag:"form",html:l+g+e,attributes:{"class":"bue-form"}}};b.eFormSubmit=function(){try{var a,c,d,f,m,e,p;for(a=0;c=this.elements[a];a++)if(c.getAttribute("required")){if(!c.value)return b.setFieldError(c),b.focusEl(c),!1;b.unsetFieldError(c)}if(d=
g(this).data("options")){if(e=b.popupOf(this))p=e.Editor;if((f=d.validate)&&!f.call(d,this,e,p))return!1;(m=d.submit)&&m.call(d,this,e,p)}}catch(l){b.delayError(l)}return!1};b.createDialogForm=function(a,c){c=b.extend({addButtons:!0,submitClose:!0},c);c.addButtons&&(a.push(b.getSubmitField(c.stitle)),a.push(b.getCancelField(c.ctitle)));c.dialogSubmit=c.submit;c.submit=b.submitDialogForm;return b.createForm(a,c)};b.submitDialogForm=function(a,c,b){this.submitClose&&c.close();return this.dialogSubmit.call(this,
a,c,b)};b.createTagForm=function(a,c,d){d=b.extend({tag:a},d);d.attributes=b.extendAttr({"class":"bue-tag-form","data-tag":a},d.attributes);d.tagSubmit=d.submit;d.submit=b.submitTagForm;c=g.map(c,b.processTagField);return b.createDialogForm(c,d)};b.submitTagForm=function(a,c,d){var f=b.tagFormToHtmlObj(a);if(a=this.tagSubmit)return a.call(this,f,c,d);d.insertHtmlObj(f)};b.tagFormToHtmlObj=function(a){var c,b,f,e={tag:a.getAttribute("data-tag"),attributes:{}};for(c=0;b=a.elements[c];c++)if(f=b.getAttribute("data-attr-name"))if("checkbox"!==
b.type||b.checked)b=b.value||b.getAttribute("data-empty-value"),"html"===f?e.html=b||"":e.attributes[f]=b;return e};b.processTagField=function(a){a=b.processField(a);a.attributes["data-attr-name"]===q&&(a.attributes["data-attr-name"]=a.name);return a};b.processField=function(a){if(!a.processed){var c,d=a.type;d||(d=a.type="text");c={name:a.name,id:"bue-field-"+ ++b.counter,"class":"bue-field form-"+d};a.required&&(c.required="required",c["class"]+=" required");null!=a.empty&&(c["data-empty-value"]=
a.empty);if("submit"===d||"button"===d)c["class"]+=" button",a.primary&&(c["class"]+=" button--primary"),a.isAction===q&&(a.isAction=!0);a.attributes=b.extendAttr(c,a.attributes);a.processed=!0}return a};b.fieldHtml=function(a){a.processed||(a=b.processField(a));var c,d,f,e=a.type,k="",g=a.attributes;switch(e){case "select":if(d=a.options)for(c in d)f={value:c},c==a.value&&(f.selected="selected"),k+=b.html("option",d[c],f);break;case "textarea":k=a.value;break;default:g=b.extend({type:e,value:a.value},
g),e="input"}return(a.prefix||"")+b.html(e,k,g)+(a.suffix||"")};b.fieldRowHtml=function(a,c){var d={"class":"bue-field-row "+a.type+"-row"};a.required&&(d["class"]+=" required-row");null!=a.title&&(c=b.html("label",a.title,{"for":a.attributes.id})+c);return b.html("div",c,d)};b.fieldRowsHtml=function(a){return b.html("div",a.join(""),{"class":"bue-field-rows"})};b.setFieldError=function(a){g(a).addClass("error").parent().addClass("error-parent")};b.unsetFieldError=function(a){g(a).removeClass("error").parent().removeClass("error-parent")};
b.getSubmitField=function(a){return{name:"op",type:"submit",value:a||b.t("OK"),primary:!0}};b.getCancelField=function(a){return{name:"cancel",type:"button",value:a||b.t("Cancel"),attributes:{onclick:"BUE.popupOf(this).close()"}}};b.browseButton=function(a,c,d,f){return b.html("button",f||b.t("Browse"),{type:"button","class":"button bue-browse-button",onclick:"return BUE.eBrowseButtonClick.apply(this, arguments);","data-browser-name":a,"data-input-name":c,"data-browse-type":d})};b.eBrowseButtonClick=
function(a){a=this.form;var c=a.elements[this.getAttribute("data-input-name")],d=this.getAttribute("data-browse-type"),f=b.fileBrowsers[this.getAttribute("data-browser-name")];c&&f&&f.call&&f.call(f,c,d,b.popupOf(a).Editor);return!1};b.html=function(a,c,d){var f,e,k;"object"===typeof a&&(c=a.html,d=a.attributes,a=a.tag);if(!a)return c||"";k="<"+a;if(d)for(f in d)e=d[f],null!=e&&(k+=" "+f+'="'+(""+e).replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")+'"');if(d=b.selfClosing(a))k+=" /";
k+=">"+(c||"");d||(k+="</"+a+">");return k};b.selfClosing=function(a){return/^(area|br|col|embed|hr|img|input|keygen|param|source|track|wbr)$/.test(a)};b.createEl=function(a){var c=b._div;c||(c=b._div=h.createElement("div"));c.innerHTML=a;a=c.firstChild;c.removeChild(a);return a};b.removeEl=function(a){var c=a.parentNode;if(c)return c.removeChild(a)};b.buildCreateEl=function(a,c,d){return b.createEl(b.html(a,c,d))};b.extendAttr=function(a,c){if(c){var d=a["class"];b.extend(a,c);d&&"class"in c&&(a["class"]=
d+(c["class"]?" "+c["class"]:""))}return a};b.parseHtml=function(a,c){var d,f,e,k,g,l;if(l=a.match(new RegExp("^<("+(c||"[a-z][a-z0-9]*")+")([^>]*)>(?:([\\s\\S]*)</\\1>)?$")))if(c=l[1],k=l[3],null!=k||b.selfClosing(c)){g={};if(l=l[2].match(/[\w-]+="[^"]*"/g))for(d=0;d<l.length;d++)f=l[d].split("="),e=f.shift(),g[e]=f.join("=").replace(/"/g,"");return{tag:c,attributes:g,html:k}}};b.plain=function(a){return(""+a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")};
b.emplain=function(a){return'<em class="plain">'+b.plain(a)+"</em>"};b.createTagChooserEl=function(a,c){var d,f,e,k,p,l,h;c=b.extend({wrapEach:"div",wrapAll:"div",applyTag:!0,onclick:b.eTagChooserLinkClick},c);d=b.html("a","",{href:"#","class":"choice-link"});d=c.wrapEach?b.html(c.wrapEach,d,{"class":"choice"}):d;p=b.createEl(d);k=b.buildCreateEl(c.wrapAll,"",{"class":"bue-tag-chooser"+(c.cname?" "+c.cname:"")});for(d=0;f=a[d];d++)h=p.cloneNode(!0),l=h.firstChild||h,e={tag:f[0],attributes:f[2]},g(l).data("htmlObj",
e).click(c.onclick).html(c.applyTag?b.html.apply(this,f):f[1]),k.appendChild(h);return k};b.eTagChooserLinkClick=function(a){var c=g(this).data("htmlObj"),d=b.popupOf(this);d.close();d.Editor.insertHtmlObj(c);a.preventDefault()};b.protos.event={bind:function(a,c){var b=this.events,f=b[a];f||(f=b[a]={});f[""+c]=c},unbind:function(a,c){var b=this.events,f=b[a];f&&(c?delete f[""+c]:delete b[a])},trigger:function(a){var c,b,f,e=this.events[a];if(e)for(c in f=Array.prototype.slice.call(arguments,1),f.unshift(this),
e)(b=e[c])&&b.apply&&b.apply(this,f)}};b.protos.state={setState:function(a){this[a]||(this[a]=!0,g(this.el).addClass(a))},unsetState:function(a){this[a]&&(this[a]=!1,g(this.el).removeClass(a))},toggleState:function(a,c){null==c&&(c=!this[a]);this[c?"setState":"unsetState"](a)}};b.extendProto=function(a){var c,d=b.protos,f=arguments;for(c=1;c<f.length;c++)b.extend(a,d[f[c]]);return a};b.protos.shortcut={addShortcut:function(a,c){this.shortcuts[a.toUpperCase()]=c},getShortcut:function(a){return this.shortcuts[a.toUpperCase()]},
removeShortcut:function(a){delete this.shortcuts[a.toUpperCase()]},fireShortcut:function(a){if(a=this.getShortcut(a)){if(a.click)return a.click(),!0;if(a.call)return!1!==a.call(a,this)}}};b.eBuildShortcut=function(a){var c,d=a.keyCode,f="";d&&(c=b.getKeySymbols(d))&&(a.ctrlKey&&(f+="CTRL+"),a.altKey&&(f+="ALT+"),a.shiftKey&&(f+="SHIFT+"),f+=c);return f};b.getKeySymbols=function(a){var c,d=b.keySymbols;if(!d){d=b.keySymbols={8:"BACKSPACE",9:"TAB",13:"ENTER",27:"ESC",32:"SPACE",37:"LEFT",38:"UP",39:"RIGHT",
40:"DOWN"};for(c=0;10>c;c++)d[48+c]=""+c;for(c=65;91>c;c++)d[c]=String.fromCharCode(c);for(c=1;13>c;c++)d[111+c]="F"+c}return 0 in arguments?d[a]:d};b.setSelectionRange=function(a,c,b){a.setSelectionRange?a.setSelectionRange(c,b):a.createTextRange&&(a=a.createTextRange(),a.collapse(),a.moveEnd("character",b),a.moveStart("character",c),a.select())};b.getSelectionRange=function(a){var c=a.selectionStart,b=a.selectionEnd;if("number"!==typeof c){var c=b=0,f,e,g=h.selection;if(g&&g.createRange)try{a.focus();
f=g.createRange();e=f.duplicate();for(e.moveToElementText(a);0>e.compareEndPoints("StartToStart",f);c++)e.moveStart("character",1);for(b=c;0>e.compareEndPoints("StartToEnd",f);b++)e.moveStart("character",1)}catch(p){}}return{start:c,end:b}};b.getTextareaValue=function(a){return b.text(a.value)};b.setTextareaValue=function(a,c){var b=a.scrollTop;a.value=c;a.scrollTop=b};b.ieMode=!(h.createElement("textarea").setSelectionRange||!h.selection||!h.selection.createRange);b.text=b.ieMode?function(a){return(""+
a).replace(/\r\n/g,"\n")}:function(a){return""+a};b.Button=function(a){this.construct(a)};var e=b.extendProto(b.Button.prototype,"state");e.construct=function(a){a&&(b.extend(this,a),this.createEl())};e.destroy=function(){this.remove();g(this.el).remove();delete this.el};e.createEl=function(){var a=this.el;a||(a=this.el=b.createEl(b.buttonHtml(this)),a.onclick=b.eButtonClick,a.onmousedown=b.eButtonMousedown,a.bueBid=this.id);return a};e.toggleDisabled=function(a){this.toggleState("disabled",a)};e.togglePressed=
function(a){this.toggleState("pressed",a)};e.remove=function(){var a=this.Editor;a&&a.removeButton(this)};e.fire=function(){var a=this.Editor;a&&a.fireButton(this)};b.eButtonClick=function(a){a=b.buttonOf(this);a.disabled||a.fire();return!1};b.eButtonMousedown=function(){var a=b.buttonOf(this);a.setState("active");g(h).one("mouseup",function(){a.unsetState("active");a=null});return!1};b.buttonHtml=function(a){var c,d=b.buttonHtmlCache;d||(d=b.buttonHtmlCache={});c=d[a.id];return null!=c?c:d[a.id]=
b.html(b.buttonHtmlObj(a))};b.buttonHtmlObj=function(a){var c=a.label||"",b=a.text||"",f=a.cname,e=a.shortcut;a={type:"button",tabindex:"-1","class":"bue-button bue-button--"+a.id,title:a.tooltip||c,"aria-label":c};f&&(-1!=f.indexOf("ficon-")&&(a["class"]+=" has-ficon"),a["class"]+=" "+f);b&&(a["class"]+=" has-text");e&&(a.title+=" ("+e+")");return{tag:"button",attributes:a,html:b}};b.buttonOf=function(a){var c=b.editorOf(a);return c?c.buttons[a.bueBid]:!1};b.History=function(a){this.construct(a)};
e=b.History.prototype;e.construct=function(a){b.extend(this,b.getHistoryDefaults(),a.settings.history);this.states=[];this.current=-1;this.Editor=a};e.destroy=function(){this.states=this.Editor=null};e.save=function(a){var c,b,f=this.Editor;if(a||!this.locked){this.locked=!0;for(this.delayUnlock();this.states[this.current+1];)this.states.pop();c=f.getContent();b=this.states;a=b.length;if(!a||c!==b[a-1].value)return a==this.limit&&(b.shift(),a--),this.current=a,b[a]={value:c,scrollTop:f.getTextarea().scrollTop,
range:f.getRange()}}};e.undo=function(){var a=this.states.length;if(a)return this.current==a-1&&this.save(!0),this.goto(this.current-1)};e.redo=function(){return this.goto(this.current+1)};e.goto=function(a){var b,d=this.Editor;if(b=this.states[a])this.locked=!0,d.setContent(b.value),d.setRange(b.range),d.getTextarea().scrollTop=b.scrollTop,this.current=a,this.locked=!1;return b};e.delayUnlock=function(){var a=this;clearTimeout(a.unlockTimer);a.unlockTimer=setTimeout(function(){a.locked=!1;a=null},
a.period)};e.handleKeyup=function(a){var b=a.keyCode,d=this.keys;a.ctrlKey&&(d=d.ctrl);d&&d[b]&&this.save()};b.getHistoryDefaults=function(a){return{limit:100,period:1E3,keys:{8:1,13:1,32:1,46:1,188:1,190:1,ctrl:{86:1,88:1}}}};b.Popup=function(a,b,d){this.construct(a,b,d)};e=b.extendProto(b.Popup.prototype,"event","state");e.construct=function(a,c,d){var f=d&&d.type;this.autoFocus=!0;"dialog"===f?this.withOverlay=!0:"quick"===f&&(this.autoClose=this.noHeader=!0);b.extend(this,d);this.no=++b.counter;
this.id="bue-popup-"+this.no;b.popups[this.id]=this;this.events={};this.createEl();this.setTitle(a);this.setContent(c)};e.destroy=function(){this.remove();g(this.el).remove();this.unbind();this.el=this.titleEl=this.contentEl=this.overlayEl=null;delete b.popups[this.id]};e.createEl=function(){var a,c,d,f;f=this.id;d=f+"-title";var e=f+"-content";a=this.el=b.createEl('<div class="bue-popup" role="dialog" tabindex="0"><div class="bue-popup-head"></div><div class="bue-popup-body"></div></div>');a.id=
f;a.setAttribute("aria-labelledby",d);a.setAttribute("aria-describedby",e);a.onkeydown=b.ePopupKeydown;a.buePid=f;if(f=this.type)a.className+=" type--"+f;if(f=this.name)a.className+=" name--"+f;if(f=this.cname)a.className+=" "+f;f=a.firstChild;f.onmousedown=b.ePopupHeadMousedown;this.noHeader&&(f.style.display="none");c=b.createEl('<a href="#" class="bue-popup-close" role="button"></a>');c.onclick=b.ePopupCloseClick;c.title=b.t("Close");f.appendChild(c);c=this.titleEl=b.createEl('<div class="bue-popup-title"></div>');
c.id=d;f.appendChild(c);d=this.contentEl=b.createEl('<div class="bue-popup-content"></div>');d.id=e;a.children[1].appendChild(d)};e.open=function(a){if(!this.on){var c=this,d=c.el;d.parentElement||h.body.appendChild(d);d.style.zIndex=b.maxZ(d)+2;c.withOverlay&&c.addOverlay();c.setState("on");c.setPosition(a);c.autoFocus&&c.focus();c.autoClose&&c.setAutoClose();c.trigger("open")}return c};e.close=function(){this.on&&(this.autoClose&&this.resetAutoClose(),this.unsetState("on"),this.removeOverlay(),
this.restoreFocus(),this.trigger("close"));return this};e.setTitle=function(a){null!=a&&g(this.titleEl).html(a)};e.setContent=function(a){null!=a&&g(this.contentEl).html(a)};e.setCss=function(a){g(this.el).css(a)};e.setPosition=function(a){a?this.setCss(a):this.el.style.top||this.Editor&&this.setCss(this.Editor.defaultPopupPosition(this))};e.focus=function(){var a;a=(a=this.getForm())&&g(a.elements).filter(":visible")[0]||g("a",this.contentEl).filter(":visible")[0]||this.el;this.restoreFocusEl=h.activeElement;
b.focusEl(a);if(a=this.Editor)a.preventFocus=!0};e.restoreFocus=function(){var a,c,d;if(d=this.restoreFocusEl)this.restoreFocusEl=null,c=b.popupOf(d),a=this.Editor,!a||c&&c.on?b.focusEl(d):a.focus()};e.setAutoClose=function(){g(h).bind("mousedown.buepopupac"+this.no,{pid:this.id},b.ePopupDocMousedown)};e.resetAutoClose=function(){g(h).unbind(".buepopupac"+this.no)};e.getForm=function(){return g("form",this.contentEl)[0]};e.addOverlay=function(){var a,c=this.el,d=this.overlayEl;d||(d=this.overlayEl=
b.createEl('<div class="bue-popup-overlay"></div>'),d.onmousedown=b.ePopupOverlayMousedown);if(a=c.parentNode)d.style.zIndex=(1*c.style.zIndex||1)-1,a.insertBefore(d,c)};e.removeOverlay=function(){var a=this.overlayEl;a&&b.removeEl(a)};e.remove=function(){this.close();var a=this.Editor;a&&a.removePopup(this)};b.ePopupKeydown=function(a){if(27==(a||n.event).keyCode)return b.popupOf(this).close(),!1};b.ePopupCloseClick=function(a){b.popupOf(this).close();return!1};b.ePopupHeadMousedown=function(a){a=
g.event.fix(a||n.event);var c=b.popupOf(this).el,d=g(c).offset();d.el=c;d.X=a.pageX;d.Y=a.pageY;g(h).bind("mousemove",d,b.ePopupHeadDrag).bind("mouseup",b.ePopupHeadDrop);return!1};b.ePopupHeadDrag=function(a){var b=a.data;g(b.el).css({left:b.left+a.pageX-b.X,top:b.top+a.pageY-b.Y});return!1};b.ePopupHeadDrop=function(a){g(h).unbind("mousemove",b.ePopupHeadDrag).unbind("mouseup",b.ePopupHeadDrop)};b.ePopupOverlayMousedown=function(a){return!1};b.ePopupDocMousedown=function(a){var c=b.getPopup(a.data.pid);
c&&c!==b.popupOf(a.target)&&c.close()};b.popupOf=function(a){return(a=g(a).closest(".bue-popup")[0])?b.getPopup(a.buePid):!1};b.maxZ=function(a,b){var d,f,e=0,k=(b||h.body).children;for(d=0;f=k[d];d++)f.offsetWidth&&f!==a&&(f=1*g(f).css("z-index"))&&f>e&&(e=f);return e};b.Editor=function(a,b){this.construct(a,b)};e=b.extendProto(b.Editor.prototype,"state","event","shortcut");e.construct=function(a,c){this.id="bue-"+(a.id||++b.counter);b.editors[this.id]=this;this.events={};this.shortcuts={};this.settings=
b.extend({},c);this.textarea=a;b.runEditorBuilders(this);this.createEl();this.textarea=null;this.controlTextarea(a);this.trigger("ready")};e.destroy=function(){this.el&&(this.trigger("destroy"),this.restoreTextarea(),g(this.el).remove(),this.el=this.toolbarEl=this.textareaWrapperEl=this.settings=this.shortcuts=this.events=null,this===b.active&&(b.active=null),delete b.editors[this.id])};e.createEl=function(){var a,c,d,f=this.el;d=this.settings;a=d.cname;if(!f){f=this.el=h.createElement("div");f.id=
this.id;f.className="bue"+(a?" "+a:"");a=this.toolbarEl=b.createEl('<div class="bue-toolbar" role="toolbar"></div>');a.onkeydown=b.eToolbarKeydown;a.onmousedown=b.eToolbarMousedown;a.bueEid=this.id;f.appendChild(a);a=this.textareaWrapperEl=b.createEl('<div class="bue-textarea-wrapper"></div>');a.onmousedown=b.eTwMousedown;a.bueEid=this.id;f.appendChild(a);if(d=d.toolbar)for(c in d)this.addButton(d[c]);for(c in this.buttons){this.buttons[c].el.tabIndex=0;break}}return f};e.focus=function(){b.focusEl(this.textarea)};
e.setContent=function(a){this.history.save();b.setTextareaValue(this.textarea,a)};e.getContent=function(){return b.getTextareaValue(this.textarea)};e.addContent=function(a,b){var d=this.getContent();d&&b&&(d+=b);return this.setContent(d+a)};e.getRange=function(){var a=this.storedRange;return a?b.extend({},a):b.getSelectionRange(this.textarea)};e.setRange=function(a,c,d,f){"object"===typeof a&&(c=a.end,a=a.start);null==c||c<a?c=a:d&&("start"===d?c=a:a=c);f&&(a+=f,c+=f);b.setSelectionRange(this.textarea,
a,c);this.storedRange&&(this.storedRange={start:a,end:c})};e.getSelection=function(){var a=this.getRange();return this.getContent().substring(a.start,a.end)};e.setSelection=function(a,c){var d=this.getContent(),f=this.getRange(),e=f.start;a=b.text(a);this.setContent(d.substr(0,e)+a+d.substr(f.end));return this.setRange(e,e+a.length,c)};e.wrapSelection=function(a,c,d){var f=this.getContent(),e=this.getRange(),g=e.start,e=e.end;a=b.text(a);c=b.text(c);this.setContent(f.substr(0,g)+a+f.substring(g,e)+
c+f.substr(e));return this.setRange(g,e,d,a.length)};e.wrapLines=function(a,c,d,f){var e=this.getSelection().replace(/\r\n|\r/g,"\n"),g=b.regesc,h,l;if(!e)return this.wrapSelection(a+c,d+f);h=new RegExp("^"+g(a+c)+"([\\s\\S]*)"+g(d+f)+"$");a=(l=e.match(h))?l[1].replace(new RegExp(g(d)+"\n"+g(c),"g"),"\n"):a+c+e.replace(/\n/g,d+"\n"+c)+d+f;return this.setSelection(a)};e.tagLines=function(a,b,d){return this.wrapLines(b?"<"+b+">\n":"",(d===q?"  ":d)+"<"+a+">","</"+a+">",b?"\n</"+b+">":"")};e.toggleTag=
function(a,b,d){return this.insertHtmlObj({tag:a,html:this.getSelection(),attributes:b},d,!0)};e.insertHtmlObj=function(a,c,d){var f=this.getSelection(),e=a.tag,g=f&&b.parseHtml(f);if(g&&g.tag===e){if(d)return this.setSelection(g.html,c);a={tag:e,html:null==a.html||a.html===f?g.html:a.html,attributes:b.extend(g.attributes,a.attributes)}}else if(!b.selfClosing(e)&&!a.html)return a=b.html(e,"",a.attributes),this.wrapSelection(a.substr(0,a.length-e.length-3),"</"+e+">",c);return this.setSelection(b.html(a),
c)};e.browseButton=function(a,c,d){var f=this.settings;if((f=f[c+"Browser"]||f.fileBrowser)&&b.fileBrowsers[f])return b.browseButton(f,a,c,d)};b.eToolbarKeydown=function(a){var c,d,f;c=g.event.fix(a||n.event);a=c.keyCode;if(!(c.ctrlKey||c.shiftKey||c.altKey||37!==a&&39!==a)){d=g(".bue-button",this).filter(":visible");if(f=d.length)c=d.index(h.activeElement),d.eq((f+c+a-38)%f).focus();return!1}if(9!==a&&13!==a&&32!==a)return b.eFireShortcut.call(this,c)};b.eToolbarMousedown=function(a){this===b.eTarget(a)&&
b.editorOf(this).focus();return!1};b.eTwMousedown=function(a){if(this===b.eTarget(a))return b.editorOf(this).focus(),!1};b.eFireShortcut=function(a){var c;if((a=b.eBuildShortcut(a))&&(c=b.editorOf(this))&&c.fireShortcut(a))return!1};b.eTarget=function(a){a||(a=n.event);return a.target||a.srcElement};b.editorOf=function(a){return a.bueEid?b.getEditor(a.bueEid):!1};b.runEditorBuilders=function(a){b.buildEditorPopups(a);b.buildEditorButtons(a);b.buildEditorPreview(a);b.buildEditorHistory(a);b.buildEditorAc(a);
b.buildEditorIndent(a);for(var c in b.builders)b.builders[c](a)};e.posSelection=e.getRange;e.makeSelection=e.setRange;e.replaceSelection=e.setSelection;e.tagSelection=e.wrapSelection;b.buildEditorAc=function(a){a.ac={};a.bind("destroy",b.destroyEditorAc);a.bind("controlTextarea",b.acControlTextarea);a.settings.acTags&&a.addAc(">",b.acHtmlTags)};b.destroyEditorAc=function(a){delete a.ac};b.acControlTextarea=function(a,c){g(c).bind("keypress.bue",b.eAcTextareaKeypress)};b.eAcTextareaKeypress=function(a){if(!a.isDefaultPrevented()){var c=
b.editorOf(this);a=String.fromCharCode(a.which);return!1!==c.fireAc(a)}};b.acHtmlTags=function(a){var c,d=a.getRange().start;a=a.getContent().substr(0,d);var f=a.lastIndexOf("<");if(-1!=f&&"/"!==a.charAt(d-1)&&(c=a.substr(f+1).match(/^([a-z][a-z0-9]*)(?:\s[^>]*)?$/))&&!b.selfClosing(c[1]))return"</"+c[1]+">"};e.addAc=function(a,b){this.ac[a]=b};e.getAc=function(a){return this.ac[a]};e.removeAc=function(a){delete this.ac[a]};e.fireAc=function(a){var b=this.getAc(a);b&&(b.call&&(b=b.call(b,this,a)),
"string"===typeof b&&this.setSelection(b,"start"));return b};b.buildEditorButtons=function(a){a.buttons={};a.bind("destroy",b.destroyEditorButtons)};b.destroyEditorButtons=function(a){for(var b in a.buttons)a.buttons[b].destroy();delete a.buttons};e.addButton=function(a){var c;"string"===typeof a&&(a=b.getButtonDefinition(a));if(a)if(a.code)a.id&&!this.getButton(a.id)&&this.appendButton(new b.Button(a));else if(c=a.template){if(c.call)try{c=c.call(a,this,g)}catch(d){c=!1,b.delayError(d)}c&&g(this.toolbarEl).append(c)}};
e.appendButton=function(a){var b;a.remove();this.buttons[a.id]=a;this.toolbarEl.appendChild(a.el);(b=a.shortcut)&&this.addShortcut(b,a.el);a.el.bueEid=this.id;a.Editor=this};e.removeButton=function(a){var c,d=this.buttons;"string"===typeof a&&(a=this.getButton(a));a&&a.Editor===this&&((c=a.shortcut)&&this.getShortcut(c)===a.el&&this.removeShortcut(c),delete d[a.id],a===this.lastFiredButton&&delete this.lastFiredButton,delete a.Editor,a.el.bueEid=null,b.removeEl(a.el))};e.getButton=function(a){return this.buttons[a]};
e.fireButton=function(a){var c,d;"string"===typeof a&&(a=this.getButton(a));if(a){delete this.preventFocus;if(c=a.code)if(this.lastFiredButton=a,"string"===typeof c)a=c.split("|"),2==a.length?this.wrapSelection(a[0],a[1]):this.setSelection(c,"end");else try{d=c.call(a,this,g)}catch(f){b.delayError(f)}this.preventFocus||this.focus()}return d};e.toggleButtonsDisabled=function(a,b){var d,f=this.buttons;null==b&&(b=this.lastFiredButton);this.toggleState("buttonsDisabled",a);a=this.buttonsDisabled;for(d in f)f[d]!==
b&&f[d].toggleDisabled(a);b&&b.togglePressed(a)};b.buildEditorHistory=function(a){a.history=new b.History(a);a.bind("destroy",b.destroyEditorHistory);a.addShortcut("Ctrl+Z",b.editorUndo);a.addShortcut("Ctrl+Y",b.editorRedo);a.addShortcut("Ctrl+Shift+Z",b.editorRedo);a.bind("controlTextarea",b.historyControlTextarea)};b.destroyEditorHistory=function(a){a.history.destroy();delete a.history};b.historyControlTextarea=function(a,c){g(c).bind("keyup.bue",b.eHistoryTextareaKeyup).one("focus.bue",b.eHistoryTextareaFocus)};
b.eHistoryTextareaKeyup=function(a){b.editorOf(this).history.handleKeyup(a)};b.eHistoryTextareaFocus=function(a){a=b.editorOf(this).history;-1==a.current&&a.save()};b.editorUndo=function(a){a.undo()};b.editorRedo=function(a){a.redo()};e.undo=function(){return this.history.undo()};e.redo=function(){return this.history.redo()};b.buildEditorIndent=function(a){a.settings.indent&&(a.addShortcut("TAB",b.editorIndent),a.addShortcut("Shift+TAB",b.editorUnindent),a.addShortcut("ENTER",b.editorAutoindent),
a.addShortcut("Ctrl+Alt+TAB",b.editorToggleIndent))};b.editorIndent=function(a){return b.editorIndentCommon(a,"indent")};b.editorUnindent=function(a){return b.editorIndentCommon(a,"unindent")};b.editorAutoindent=function(a){return b.editorIndentCommon(a,"autoindent")};b.editorIndentCommon=function(a,b){var d=a.settings;if(!d.indent)return!1;a[b](d.indentStr||"  ")};b.editorToggleIndent=function(a){a=a.settings;a.indent=!a.indent};e.indent=function(a){var b=this.getSelection();if(b&&-1!=b.indexOf("\n")){var d=
this.getRange(),f=this.getContent(),e=d.start,d=d.end,b=b.split("\n"),g=f.substr(0,e).lastIndexOf("\n")+1,h=a.length;this.setContent(f.substr(0,g)+a+f.substring(g,e)+b.join("\n"+a)+f.substr(d));this.setRange(e==g?e:e+h,d+b.length*h)}else this.wrapSelection(a,"")};e.unindent=function(a){var c=this.getContent(),d=this.getRange(),f=d.start,d=d.end,e=c.substr(0,f).lastIndexOf("\n")+1,g=c.substring(e,d),h,l=g.split("\n"),n=[];h=new RegExp("^"+b.regesc(a.charAt(0))+"{1,"+a.length+"}");for(a=0;a<l.length;a++)n[a]=
l[a].replace(h,"");h=n.join("\n");a=h.length;a!==g.length&&(this.setContent(c.substr(0,e)+h+c.substr(d)),this.setRange(Math.max(e,f+n[0].length-l[0].length),e+a))};e.autoindent=function(a){var c,d=this.getContent(),f=this.getRange().start,e=d.substr(0,f).lastIndexOf("\n")+1,g="\n";f!=e&&(c=d.substr(e).match(new RegExp("^("+b.regesc(a.charAt(0))+"+)")))&&(g+=c[1]);this.setSelection(g,"end")};b.buildEditorPopups=function(a){a.popups={};a.bind("destroy",b.destroyEditorPopups)};b.destroyEditorPopups=
function(a){for(var b in a.popups)a.popups[b].destroy();delete a.popups};e.createPopup=function(a,c,d,f){var e=this.popups[a];e||(f=b.extend({name:a,Editor:this},f),e=this.popups[a]=new b.Popup(c,d,f));return e};e.getPopup=function(a){return this.popups[a]};e.removePopup=function(a){"string"===typeof a&&(a=this.getPopup(a));a&&a.Editor===this&&(a.close(),delete this.popups[a.name],delete a.Editor,b.removeEl(a.el))};e.createDialog=function(a,c,d,f){f=b.extend({type:"dialog"},f);return this.createPopup(a,
c,d,f)};e.tagDialog=function(a,b,d){return(this.getTagDialog(a)||this.createTagDialog(a,b,d)).open()};e.createTagDialog=function(a,c,d){var f,e;d="string"===typeof d?{title:d}:d||{};f=d.name||a+"-tag-dialog";if(e=this.getPopup(f))return e;e=d.title||b.t("Tag editor - @tag",{"@tag":a.toUpperCase()});c=b.createTagForm(a,c,d);e=this.createDialog(f,e,c,{tag:a});e.bind("open",b.tagDialogOnOpen);return e};e.getTagDialog=function(a){return this.getPopup(a+"-tag-dialog")};e.tagChooser=function(a,c){var d=
this.getPopup("tag-chooser");d||(d=this.createPopup("tag-chooser",null,null,{type:"quick"}));d.setContent(b.createTagChooserEl(a,c));return d.open()};e.defaultPopupPosition=function(a){var b,d,e;b=this.lastFiredButton;if(!b)return g(this.textarea).offset();d=b.el;b=g(d).offset();e=a.el.offsetWidth||50;a=b.left-e/2+d.offsetWidth/2;b=b.top+d.offsetHeight;d=a+e-(n.innerWidth||h.documentElement.clientWidth);0<d&&(a-=d);return{left:Math.max(10,a),top:b}};b.tagDialogOnOpen=function(a){var c,d,e=a.getForm();
e.reset();if(d=a.Editor.getSelection())for(c in(a=b.parseHtml(d,a.tag))?(d=a.attributes,d.html=a.html||""):d={html:d},d)if(a=e.elements[c])a.value=d[c]};b.buildEditorPreview=function(a){a.bind("destroy",b.destroyEditorPreview)};b.destroyEditorPreview=function(a){a.hidePreview();delete a.previewEl};e.togglePreview=function(a){return this.previewing?this.hidePreview():this.showPreview(a)};e.showPreview=function(a){this.setState("previewing");return this.setPreviewContent(a)};e.hidePreview=function(){var a;
this.unsetState("previewing");if(a=this.previewXHR)delete this.previewXHR,a.abort&&a.abort()};e.setPreviewContent=function(a){var b=this.getPreviewEl();g(b).html(a||"");return b};e.getPreviewEl=function(){var a=this.previewEl;a||(a=this.previewEl=b.createEl('<div class="bue-preview"></div>'),this.textareaWrapperEl.appendChild(a));return a};e.controlTextarea=function(a){var c,d=this.textarea;a&&a!==d&&(d&&this.restoreTextarea(),(c=a.parentNode)&&c.insertBefore(this.el,a),this.textareaWrapperEl.appendChild(a),
a.className+=" bue-textarea",a.bueEid=this.id,this.textarea=a,g(a).bind("focus.bue",b.eTextareaFocus).bind("blur.bue",b.eTextareaBlur).bind("keydown.bue",b.eTextareaKeydown).bind("keypress.bue",b.eTextareaKeypress),"onbeforeactivate"in a&&!n.atob&&g(a).bind("beforeactivate.bue",b.eTextareaBeforeactivate).bind("beforedeactivate.bue",b.eTextareaBeforedeactivate),this.trigger("controlTextarea",a,d))};e.restoreTextarea=function(){var a=this.textarea;a&&(this.trigger("restoreTextarea",a),g(a).unbind(".bue").removeClass("bue-textarea").insertAfter(this.el),
a.bueEid=this.textarea=this.storedRange=null)};e.getTextarea=function(){return this.textarea};b.eTextareaFocus=function(a){a=b.editorOf(this);b.active=a;a.setState("focused")};b.eTextareaBlur=function(a){b.editorOf(this).unsetState("focused")};b.eTextareaKeydown=function(a){return b.eFireShortcut.call(this,a)};b.eTextareaBeforeactivate=function(a){a=b.editorOf(this);var c=a.storedRange;c&&(a.storedRange=null,a.setRange(c))};b.eTextareaBeforedeactivate=function(a){a=b.editorOf(this);a.storedRange=
a.getRange()};b.registerButtons("BUE",function(){for(var a={"-":{id:"-",template:'<span class="bue-separator"></span>'},"/":{id:"/",template:'<span class="bue-newline"></span>'},bold:{id:"bold",label:b.t("Bold"),cname:"ficon-bold",code:"<strong>|</strong>",shortcut:"Ctrl+B"},italic:{id:"italic",label:b.t("Italic"),cname:"ficon-italic",code:"<em>|</em>",shortcut:"Ctrl+I"},underline:{id:"underline",label:b.t("Underline"),cname:"ficon-underline",code:"<ins>|</ins>",shortcut:"Ctrl+U"},strike:{id:"strike",
label:b.t("Strikethrough"),cname:"ficon-strike",code:"<del>|</del>"},quote:{id:"quote",label:b.t("Quote"),cname:"ficon-quote",code:"<blockquote>|</blockquote>"},code:{id:"code",label:b.t("Code"),cname:"ficon-code",code:"<code>|</code>"},ul:{id:"ul",label:b.t("Bulleted list"),cname:"ficon-ul",code:b.editorInsertUL},ol:{id:"ol",label:b.t("Numbered list"),cname:"ficon-ol",code:b.editorInsertOL},link:{id:"link",label:b.t("Link"),cname:"ficon-link",code:b.editorInsertLink},image:{id:"image",label:b.t("Image"),
cname:"ficon-image",code:b.editorInsertImage},undo:{id:"undo",label:b.t("Undo"),cname:"ficon-undo",shortcut:"Ctrl+Z",code:b.editorUndo},redo:{id:"redo",label:b.t("Redo"),cname:"ficon-redo",shortcut:"Ctrl+Y",code:b.editorRedo}},c,d=1;7>d;d++)c="h"+d,a[c]={id:c,label:b.t("Heading !n",{"!n":d}),text:"H"+d,code:"<"+c+">|</"+c+">"};return a});b.editorInsertUL=function(a){a.tagLines("li","ul")};b.editorInsertOL=function(a){a.tagLines("li","ol")};b.editorInsertLink=function(a){a.tagDialog("a",[{name:"href",
title:b.t("URL"),required:!0,suffix:a.browseButton("href","link")},{name:"html",title:b.t("Text")}],b.t("Link"))};b.editorInsertImage=function(a){a.tagDialog("img",[{name:"src",title:b.t("URL"),required:!0,suffix:a.browseButton("src","image")},{name:"width",title:b.t("Width x Height"),suffix:" x ",getnext:!0,attributes:{size:3}},{name:"height",attributes:{size:3}},{name:"alt",title:b.t("Alternative text"),empty:""}],b.t("Image"))}})(jQuery,window,document);
;
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
;
(function ($, Drupal, BUE) {
'use strict';

/**
 * @file
 * Translates BUEditor core strings.
 */

/**
 * Override BUE translation with Drupal translation.
 */
BUE.dt = BUE.t;
BUE.t = function(str, tokens) {
  return BUE.i18n[str] ? BUE.dt(str, tokens) : Drupal.t(str, tokens);
};

/**
 * Translation strings of BUEditor core library.
 * Triggering javascript translation by including the strings here.
 */

/*
Drupal.t('Bold')
Drupal.t('Italic')
Drupal.t('Underline')
Drupal.t('Strikethrough')
Drupal.t('Quote')
Drupal.t('Code')
Drupal.t('Bulleted list')
Drupal.t('Numbered list')
Drupal.t('Link')
Drupal.t('Image')
Drupal.t('Undo')
Drupal.t('Redo')
Drupal.t('Heading !n')
Drupal.t('Close')
Drupal.t('Tag editor - @tag')
Drupal.t('OK')
Drupal.t('Cancel')
Drupal.t('URL')
Drupal.t('Text')
Drupal.t('Width x Height')
Drupal.t('Alternative text')
Drupal.t('Browse')
*/

})(jQuery, Drupal, BUE);
;
(function ($, Drupal) {
'use strict';

/**
 * @file
 * Provides a library for processing user input asynchronously.
 * Requires 'access ajax preview' permission on the server side.
 * Can be used independently of BUEditor libraries.
 */

/**
 * Asynchronous user input processor.
 * Accepts data object containing input, format, and callback.
 * Executes the callback with the data object containing output and status.
 */
var xPreview = Drupal.xPreview = function(opt) {
  var settings, result;
  // Do nothing if there is no callback
  if (!opt || !opt.callback) return;
  // Set defaults
  opt.output = '';
  opt.status = false;
  // Check settings
  if (!(settings = drupalSettings.xPreview) || !settings.url) {
    opt.output = Drupal.t('Missing ajax parameters.');
  }
  // Check empty input.
  else if (!(opt.input = $.trim(opt.input))) {
    opt.status = true;
  }
  // Check cached results
  else if (result = xPreview.getCache(opt)) {
    $.extend(opt, result);
  }
  // Create a new request and return.
  else {
    return $.ajax({
      url: settings.url,
      data: {input: opt.input, format: opt.format},
      type: 'POST',
      dataType: 'json',
      success: xPreview.succes,
      error: xPreview.error,
      complete: xPreview.complete,
      opt: opt
    });
  }
  // No request is sent. Run the callback with minimum delay.
  xPreview.delay(opt);
};

/**
 * Success handler of preview request.
 */
xPreview.succes = function(response) {
  $.extend(this.opt, response);
};

/**
 * Error handler of preview request.
 */
xPreview.error = function(xhr) {
  var msg;
  if (xhr.status == 403) {
    msg = Drupal.t("You don't have permission to use ajax preview.");
  }
  else {
    msg = Drupal.t('An AJAX HTTP error occurred.') + '<br />\n';
    msg += Drupal.t('HTTP Result Code: !status', {'!status': xhr.status*1 || 0}) + '<br />\n';
    msg += Drupal.t('StatusText: !statusText', {'!statusText': Drupal.checkPlain(xhr.statusText || 'N/A')});
  }
  this.opt.output = msg;
};

/**
 * Complete handler of preview request.
 */
xPreview.complete = function(xhr) {
  var opt = this.opt;
  delete this.opt;
  opt.xhr = xhr;
  xPreview.setCache(opt);
  opt.callback.call(this, opt);
};

/**
 * Delays the execution of completion callback.
 */
xPreview.delay = function(opt) {
  setTimeout(function() {
    opt.callback(opt);
    opt = null;
  });
};

/**
 * Returns the cached result.
 */
xPreview.getCache = function(opt) {
  var cache = xPreview.cache;
  if (cache) return cache[opt.format + ' ' + opt.input];
};

/**
 * Saves the result to the cache.
 */
xPreview.setCache = function(opt) {
  // Keep only one result
  var cache = xPreview.cache = {};
  cache[opt.format + ' ' + opt.input] = {status: opt.status, output: opt.output};
};

})(jQuery, Drupal);
;
(function ($, Drupal, BUE) {
'use strict';

/**
 * @file
 * Defines Ajax Preview button for BUEditor.
 */

/**
 * Register buttons.
 */
BUE.registerButtons('bueditor.xpreview', function() {
  return {
    xpreview: {
      id: 'xpreview',
      label: Drupal.t('Preview'),
      cname: 'ficon-preview',
      code: BUE.xPreview
    }
  };
});

/**
 * Previews editor content asynchronously.
 */
var bueXP = BUE.xPreview = function(E) {
  E.toggleButtonsDisabled();
  E.togglePreview();
  if (E.previewing) {
    E.setPreviewContent('<div class="loading">' + Drupal.t('Loading...') + '</div>');
    E.previewXHR = Drupal.xPreview({
      input: E.getContent(),
      format: E.settings.inputFormat,
      callback: bueXP.complete,
      E: E
    });
  }
};

/**
 * Complete handler of ajax preview.
 */
bueXP.complete = function(opt) {
  var E = opt.E, success = opt.status, output = opt.output; 
  if (E.previewing) {
    if (!success) output = bueXP.wrapMsg(output);
    E.setPreviewContent(output);
    // Attach behaviors
    if (success && output) {
      Drupal.attachBehaviors(E.previewEl, window.drupalSettings);
    }
    E.previewXHR = null;
  }
};

/**
 * Formats a preview message.
 */
bueXP.wrapMsg = function(msg, type) {
  return '<div class="messages messages--' + (type || 'error') + '">' + msg + '</div>';
};

})(jQuery, Drupal, BUE);
;
/**
 * @file
 * Text behaviors.
 */

(function ($, Drupal) {

  'use strict';

  /**
   * Auto-hide summary textarea if empty and show hide and unhide links.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches auto-hide behavior on `text-summary` events.
   */
  Drupal.behaviors.textSummary = {
    attach: function (context, settings) {
      $(context).find('.js-text-summary').once('text-summary').each(function () {
        var $widget = $(this).closest('.js-text-format-wrapper');

        var $summary = $widget.find('.js-text-summary-wrapper');
        var $summaryLabel = $summary.find('label').eq(0);
        var $full = $widget.find('.js-text-full').closest('.js-form-item');
        var $fullLabel = $full.find('label').eq(0);

        // Create a placeholder label when the field cardinality is greater
        // than 1.
        if ($fullLabel.length === 0) {
          $fullLabel = $('<label></label>').prependTo($full);
        }

        // Set up the edit/hide summary link.
        var $link = $('<span class="field-edit-link"> (<button type="button" class="link link-edit-summary">' + Drupal.t('Hide summary') + '</button>)</span>');
        var $button = $link.find('button');
        var toggleClick = true;
        $link.on('click', function (e) {
          if (toggleClick) {
            $summary.hide();
            $button.html(Drupal.t('Edit summary'));
            $link.appendTo($fullLabel);
          }
          else {
            $summary.show();
            $button.html(Drupal.t('Hide summary'));
            $link.appendTo($summaryLabel);
          }
          e.preventDefault();
          toggleClick = !toggleClick;
        }).appendTo($summaryLabel);

        // If no summary is set, hide the summary field.
        if ($widget.find('.js-text-summary').val() === '') {
          $link.trigger('click');
        }
      });
    }
  };

})(jQuery, Drupal);
;
/**
 * @file
 * Responsive navigation tabs.
 *
 * This also supports collapsible navigable is the 'is-collapsible' class is
 * added to the main element, and a target element is included.
 */
(function ($, Drupal) {

  'use strict';

  function init(i, tab) {
    var $tab = $(tab);
    var $target = $tab.find('[data-drupal-nav-tabs-target]');
    var isCollapsible = $tab.hasClass('is-collapsible');

    function openMenu(e) {
      $target.toggleClass('is-open');
    }

    function handleResize(e) {
      $tab.addClass('is-horizontal');
      var $tabs = $tab.find('.tabs');
      var isHorizontal = $tabs.outerHeight() <= $tabs.find('.tabs__tab').outerHeight();
      $tab.toggleClass('is-horizontal', isHorizontal);
      if (isCollapsible) {
        $tab.toggleClass('is-collapse-enabled', !isHorizontal);
      }
      if (isHorizontal) {
        $target.removeClass('is-open');
      }
    }

    $tab.addClass('position-container is-horizontal-enabled');

    $tab.on('click.tabs', '[data-drupal-nav-tabs-trigger]', openMenu);
    $(window).on('resize.tabs', Drupal.debounce(handleResize, 150)).trigger('resize.tabs');
  }

  /**
   * Initialise the tabs JS.
   */
  Drupal.behaviors.navTabs = {
    attach: function (context, settings) {
      var $tabs = $(context).find('[data-drupal-nav-tabs]');
      if ($tabs.length) {
        var notSmartPhone = window.matchMedia('(min-width: 300px)');
        if (notSmartPhone.matches) {
          $tabs.once('nav-tabs').each(init);
        }
      }
    }
  };

})(jQuery, Drupal);
;
/**
 * @file
 * Adds an HTML element and method to trigger audio UAs to read system messages.
 *
 * Use {@link Drupal.announce} to indicate to screen reader users that an
 * element on the page has changed state. For instance, if clicking a link
 * loads 10 more items into a list, one might announce the change like this.
 *
 * @example
 * $('#search-list')
 *   .on('itemInsert', function (event, data) {
 *     // Insert the new items.
 *     $(data.container.el).append(data.items.el);
 *     // Announce the change to the page contents.
 *     Drupal.announce(Drupal.t('@count items added to @container',
 *       {'@count': data.items.length, '@container': data.container.title}
 *     ));
 *   });
 */

(function (Drupal, debounce) {

  'use strict';

  var liveElement;
  var announcements = [];

  /**
   * Builds a div element with the aria-live attribute and add it to the DOM.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches the behavior for drupalAnnouce.
   */
  Drupal.behaviors.drupalAnnounce = {
    attach: function (context) {
      // Create only one aria-live element.
      if (!liveElement) {
        liveElement = document.createElement('div');
        liveElement.id = 'drupal-live-announce';
        liveElement.className = 'visually-hidden';
        liveElement.setAttribute('aria-live', 'polite');
        liveElement.setAttribute('aria-busy', 'false');
        document.body.appendChild(liveElement);
      }
    }
  };

  /**
   * Concatenates announcements to a single string; appends to the live region.
   */
  function announce() {
    var text = [];
    var priority = 'polite';
    var announcement;

    // Create an array of announcement strings to be joined and appended to the
    // aria live region.
    var il = announcements.length;
    for (var i = 0; i < il; i++) {
      announcement = announcements.pop();
      text.unshift(announcement.text);
      // If any of the announcements has a priority of assertive then the group
      // of joined announcements will have this priority.
      if (announcement.priority === 'assertive') {
        priority = 'assertive';
      }
    }

    if (text.length) {
      // Clear the liveElement so that repeated strings will be read.
      liveElement.innerHTML = '';
      // Set the busy state to true until the node changes are complete.
      liveElement.setAttribute('aria-busy', 'true');
      // Set the priority to assertive, or default to polite.
      liveElement.setAttribute('aria-live', priority);
      // Print the text to the live region. Text should be run through
      // Drupal.t() before being passed to Drupal.announce().
      liveElement.innerHTML = text.join('\n');
      // The live text area is updated. Allow the AT to announce the text.
      liveElement.setAttribute('aria-busy', 'false');
    }
  }

  /**
   * Triggers audio UAs to read the supplied text.
   *
   * The aria-live region will only read the text that currently populates its
   * text node. Replacing text quickly in rapid calls to announce results in
   * only the text from the most recent call to {@link Drupal.announce} being
   * read. By wrapping the call to announce in a debounce function, we allow for
   * time for multiple calls to {@link Drupal.announce} to queue up their
   * messages. These messages are then joined and append to the aria-live region
   * as one text node.
   *
   * @param {string} text
   *   A string to be read by the UA.
   * @param {string} [priority='polite']
   *   A string to indicate the priority of the message. Can be either
   *   'polite' or 'assertive'.
   *
   * @return {function}
   *   The return of the call to debounce.
   *
   * @see http://www.w3.org/WAI/PF/aria-practices/#liveprops
   */
  Drupal.announce = function (text, priority) {
    // Save the text and priority into a closure variable. Multiple simultaneous
    // announcements will be concatenated and read in sequence.
    announcements.push({
      text: text,
      priority: priority
    });
    // Immediately invoke the function that debounce returns. 200 ms is right at
    // the cusp where humans notice a pause, so we will wait
    // at most this much time before the set of queued announcements is read.
    return (debounce(announce, 200)());
  };
}(Drupal, Drupal.debounce));
;
(function(){if(window.matchMedia&&window.matchMedia("all").addListener){return false}var e=window.matchMedia,i=e("only all").matches,n=false,t=0,a=[],r=function(i){clearTimeout(t);t=setTimeout(function(){for(var i=0,n=a.length;i<n;i++){var t=a[i].mql,r=a[i].listeners||[],o=e(t.media).matches;if(o!==t.matches){t.matches=o;for(var s=0,l=r.length;s<l;s++){r[s].call(window,t)}}}},30)};window.matchMedia=function(t){var o=e(t),s=[],l=0;o.addListener=function(e){if(!i){return}if(!n){n=true;window.addEventListener("resize",r,true)}if(l===0){l=a.push({mql:o,listeners:s})}s.push(e)};o.removeListener=function(e){for(var i=0,n=s.length;i<n;i++){if(s[i]===e){s.splice(i,1)}}};return o}})();
;
/**
 * @file
 * Builds a nested accordion widget.
 *
 * Invoke on an HTML list element with the jQuery plugin pattern.
 *
 * @example
 * $('.toolbar-menu').drupalToolbarMenu();
 */

(function ($, Drupal, drupalSettings) {

  'use strict';

  /**
   * Store the open menu tray.
   */
  var activeItem = Drupal.url(drupalSettings.path.currentPath);

  $.fn.drupalToolbarMenu = function () {

    var ui = {
      handleOpen: Drupal.t('Extend'),
      handleClose: Drupal.t('Collapse')
    };

    /**
     * Handle clicks from the disclosure button on an item with sub-items.
     *
     * @param {Object} event
     *   A jQuery Event object.
     */
    function toggleClickHandler(event) {
      var $toggle = $(event.target);
      var $item = $toggle.closest('li');
      // Toggle the list item.
      toggleList($item);
      // Close open sibling menus.
      var $openItems = $item.siblings().filter('.open');
      toggleList($openItems, false);
    }

    /**
     * Handle clicks from a menu item link.
     *
     * @param {Object} event
     *   A jQuery Event object.
     */
    function linkClickHandler(event) {
      // If the toolbar is positioned fixed (and therefore hiding content
      // underneath), then users expect clicks in the administration menu tray
      // to take them to that destination but for the menu tray to be closed
      // after clicking: otherwise the toolbar itself is obstructing the view
      // of the destination they chose.
      if (!Drupal.toolbar.models.toolbarModel.get('isFixed')) {
        Drupal.toolbar.models.toolbarModel.set('activeTab', null);
      }
      // Stopping propagation to make sure that once a toolbar-box is clicked
      // (the whitespace part), the page is not redirected anymore.
      event.stopPropagation();
    }

    /**
     * Toggle the open/close state of a list is a menu.
     *
     * @param {jQuery} $item
     *   The li item to be toggled.
     *
     * @param {Boolean} switcher
     *   A flag that forces toggleClass to add or a remove a class, rather than
     *   simply toggling its presence.
     */
    function toggleList($item, switcher) {
      var $toggle = $item.children('.toolbar-box').children('.toolbar-handle');
      switcher = (typeof switcher !== 'undefined') ? switcher : !$item.hasClass('open');
      // Toggle the item open state.
      $item.toggleClass('open', switcher);
      // Twist the toggle.
      $toggle.toggleClass('open', switcher);
      // Adjust the toggle text.
      $toggle
        .find('.action')
        // Expand Structure, Collapse Structure.
        .text((switcher) ? ui.handleClose : ui.handleOpen);
    }

    /**
     * Add markup to the menu elements.
     *
     * Items with sub-elements have a list toggle attached to them. Menu item
     * links and the corresponding list toggle are wrapped with in a div
     * classed with .toolbar-box. The .toolbar-box div provides a positioning
     * context for the item list toggle.
     *
     * @param {jQuery} $menu
     *   The root of the menu to be initialized.
     */
    function initItems($menu) {
      var options = {
        class: 'toolbar-icon toolbar-handle',
        action: ui.handleOpen,
        text: ''
      };
      // Initialize items and their links.
      $menu.find('li > a').wrap('<div class="toolbar-box">');
      // Add a handle to each list item if it has a menu.
      $menu.find('li').each(function (index, element) {
        var $item = $(element);
        if ($item.children('ul.toolbar-menu').length) {
          var $box = $item.children('.toolbar-box');
          options.text = Drupal.t('@label', {'@label': $box.find('a').text()});
          $item.children('.toolbar-box')
            .append(Drupal.theme('toolbarMenuItemToggle', options));
        }
      });
    }

    /**
     * Adds a level class to each list based on its depth in the menu.
     *
     * This function is called recursively on each sub level of lists elements
     * until the depth of the menu is exhausted.
     *
     * @param {jQuery} $lists
     *   A jQuery object of ul elements.
     *
     * @param {number} level
     *   The current level number to be assigned to the list elements.
     */
    function markListLevels($lists, level) {
      level = (!level) ? 1 : level;
      var $lis = $lists.children('li').addClass('level-' + level);
      $lists = $lis.children('ul');
      if ($lists.length) {
        markListLevels($lists, level + 1);
      }
    }

    /**
     * On page load, open the active menu item.
     *
     * Marks the trail of the active link in the menu back to the root of the
     * menu with .menu-item--active-trail.
     *
     * @param {jQuery} $menu
     *   The root of the menu.
     */
    function openActiveItem($menu) {
      var pathItem = $menu.find('a[href="' + location.pathname + '"]');
      if (pathItem.length && !activeItem) {
        activeItem = location.pathname;
      }
      if (activeItem) {
        var $activeItem = $menu.find('a[href="' + activeItem + '"]').addClass('menu-item--active');
        var $activeTrail = $activeItem.parentsUntil('.root', 'li').addClass('menu-item--active-trail');
        toggleList($activeTrail, true);
      }
    }

    // Return the jQuery object.
    return this.each(function (selector) {
      var $menu = $(this).once('toolbar-menu');
      if ($menu.length) {
        // Bind event handlers.
        $menu
          .on('click.toolbar', '.toolbar-box', toggleClickHandler)
          .on('click.toolbar', '.toolbar-box a', linkClickHandler);

        $menu.addClass('root');
        initItems($menu);
        markListLevels($menu);
        // Restore previous and active states.
        openActiveItem($menu);
      }
    });
  };

  /**
   * A toggle is an interactive element often bound to a click handler.
   *
   * @param {object} options
   *   Options for the button.
   * @param {string} options.class
   *   Class to set on the button.
   * @param {string} options.action
   *   Action for the button.
   * @param {string} options.text
   *   Used as label for the button.
   *
   * @return {string}
   *   A string representing a DOM fragment.
   */
  Drupal.theme.toolbarMenuItemToggle = function (options) {
    return '<button class="' + options['class'] + '"><span class="action">' + options.action + '</span><span class="label">' + options.text + '</span></button>';
  };

}(jQuery, Drupal, drupalSettings));
;
/**
 * @file
 * Defines the behavior of the Drupal administration toolbar.
 */

(function ($, Drupal, drupalSettings) {

  'use strict';

  // Merge run-time settings with the defaults.
  var options = $.extend(
    {
      breakpoints: {
        'toolbar.narrow': '',
        'toolbar.standard': '',
        'toolbar.wide': ''
      }
    },
    drupalSettings.toolbar,
    // Merge strings on top of drupalSettings so that they are not mutable.
    {
      strings: {
        horizontal: Drupal.t('Horizontal orientation'),
        vertical: Drupal.t('Vertical orientation')
      }
    }
  );

  /**
   * Registers tabs with the toolbar.
   *
   * The Drupal toolbar allows modules to register top-level tabs. These may
   * point directly to a resource or toggle the visibility of a tray.
   *
   * Modules register tabs with hook_toolbar().
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches the toolbar rendering functionality to the toolbar element.
   */
  Drupal.behaviors.toolbar = {
    attach: function (context) {
      // Verify that the user agent understands media queries. Complex admin
      // toolbar layouts require media query support.
      if (!window.matchMedia('only screen').matches) {
        return;
      }
      // Process the administrative toolbar.
      $(context).find('#toolbar-administration').once('toolbar').each(function () {

        // Establish the toolbar models and views.
        var model = Drupal.toolbar.models.toolbarModel = new Drupal.toolbar.ToolbarModel({
          locked: JSON.parse(localStorage.getItem('Drupal.toolbar.trayVerticalLocked')) || false,
          activeTab: document.getElementById(JSON.parse(localStorage.getItem('Drupal.toolbar.activeTabID')))
        });
        Drupal.toolbar.views.toolbarVisualView = new Drupal.toolbar.ToolbarVisualView({
          el: this,
          model: model,
          strings: options.strings
        });
        Drupal.toolbar.views.toolbarAuralView = new Drupal.toolbar.ToolbarAuralView({
          el: this,
          model: model,
          strings: options.strings
        });
        Drupal.toolbar.views.bodyVisualView = new Drupal.toolbar.BodyVisualView({
          el: this,
          model: model
        });

        // Render collapsible menus.
        var menuModel = Drupal.toolbar.models.menuModel = new Drupal.toolbar.MenuModel();
        Drupal.toolbar.views.menuVisualView = new Drupal.toolbar.MenuVisualView({
          el: $(this).find('.toolbar-menu-administration').get(0),
          model: menuModel,
          strings: options.strings
        });

        // Handle the resolution of Drupal.toolbar.setSubtrees.
        // This is handled with a deferred so that the function may be invoked
        // asynchronously.
        Drupal.toolbar.setSubtrees.done(function (subtrees) {
          menuModel.set('subtrees', subtrees);
          var theme = drupalSettings.ajaxPageState.theme;
          localStorage.setItem('Drupal.toolbar.subtrees.' + theme, JSON.stringify(subtrees));
          // Indicate on the toolbarModel that subtrees are now loaded.
          model.set('areSubtreesLoaded', true);
        });

        // Attach a listener to the configured media query breakpoints.
        for (var label in options.breakpoints) {
          if (options.breakpoints.hasOwnProperty(label)) {
            var mq = options.breakpoints[label];
            var mql = Drupal.toolbar.mql[label] = window.matchMedia(mq);
            // Curry the model and the label of the media query breakpoint to
            // the mediaQueryChangeHandler function.
            mql.addListener(Drupal.toolbar.mediaQueryChangeHandler.bind(null, model, label));
            // Fire the mediaQueryChangeHandler for each configured breakpoint
            // so that they process once.
            Drupal.toolbar.mediaQueryChangeHandler.call(null, model, label, mql);
          }
        }

        // Trigger an initial attempt to load menu subitems. This first attempt
        // is made after the media query handlers have had an opportunity to
        // process. The toolbar starts in the vertical orientation by default,
        // unless the viewport is wide enough to accommodate a horizontal
        // orientation. Thus we give the Toolbar a chance to determine if it
        // should be set to horizontal orientation before attempting to load
        // menu subtrees.
        Drupal.toolbar.views.toolbarVisualView.loadSubtrees();

        $(document)
          // Update the model when the viewport offset changes.
          .on('drupalViewportOffsetChange.toolbar', function (event, offsets) {
            model.set('offsets', offsets);
          });

        // Broadcast model changes to other modules.
        model
          .on('change:orientation', function (model, orientation) {
            $(document).trigger('drupalToolbarOrientationChange', orientation);
          })
          .on('change:activeTab', function (model, tab) {
            $(document).trigger('drupalToolbarTabChange', tab);
          })
          .on('change:activeTray', function (model, tray) {
            $(document).trigger('drupalToolbarTrayChange', tray);
          });

        // If the toolbar's orientation is horizontal and no active tab is
        // defined then show the tray of the first toolbar tab by default (but
        // not the first 'Home' toolbar tab).
        if (Drupal.toolbar.models.toolbarModel.get('orientation') === 'horizontal' && Drupal.toolbar.models.toolbarModel.get('activeTab') === null) {
          Drupal.toolbar.models.toolbarModel.set({
            activeTab: $('.toolbar-bar .toolbar-tab:not(.home-toolbar-tab) a').get(0)
          });
        }
      });
    }
  };

  /**
   * Toolbar methods of Backbone objects.
   *
   * @namespace
   */
  Drupal.toolbar = {

    /**
     * A hash of View instances.
     *
     * @type {object.<string, Backbone.View>}
     */
    views: {},

    /**
     * A hash of Model instances.
     *
     * @type {object.<string, Backbone.Model>}
     */
    models: {},

    /**
     * A hash of MediaQueryList objects tracked by the toolbar.
     *
     * @type {object.<string, object>}
     */
    mql: {},

    /**
     * Accepts a list of subtree menu elements.
     *
     * A deferred object that is resolved by an inlined JavaScript callback.
     *
     * @type {jQuery.Deferred}
     *
     * @see toolbar_subtrees_jsonp().
     */
    setSubtrees: new $.Deferred(),

    /**
     * Respond to configured narrow media query changes.
     *
     * @param {Drupal.toolbar.ToolbarModel} model
     *   A toolbar model
     * @param {string} label
     *   Media query label.
     * @param {object} mql
     *   A MediaQueryList object.
     */
    mediaQueryChangeHandler: function (model, label, mql) {
      switch (label) {
        case 'toolbar.narrow':
          model.set({
            isOriented: mql.matches,
            isTrayToggleVisible: false
          });
          // If the toolbar doesn't have an explicit orientation yet, or if the
          // narrow media query doesn't match then set the orientation to
          // vertical.
          if (!mql.matches || !model.get('orientation')) {
            model.set({orientation: 'vertical'}, {validate: true});
          }
          break;

        case 'toolbar.standard':
          model.set({
            isFixed: mql.matches
          });
          break;

        case 'toolbar.wide':
          model.set({
            orientation: ((mql.matches) ? 'horizontal' : 'vertical')
          }, {validate: true});
          // The tray orientation toggle visibility does not need to be
          // validated.
          model.set({
            isTrayToggleVisible: mql.matches
          });
          break;

        default:
          break;
      }
    }
  };

  /**
   * A toggle is an interactive element often bound to a click handler.
   *
   * @return {string}
   *   A string representing a DOM fragment.
   */
  Drupal.theme.toolbarOrientationToggle = function () {
    return '<div class="toolbar-toggle-orientation"><div class="toolbar-lining">' +
      '<button class="toolbar-icon" type="button"></button>' +
      '</div></div>';
  };

  /**
   * Ajax command to set the toolbar subtrees.
   *
   * @param {Drupal.Ajax} ajax
   *   {@link Drupal.Ajax} object created by {@link Drupal.ajax}.
   * @param {object} response
   *   JSON response from the Ajax request.
   * @param {number} [status]
   *   XMLHttpRequest status.
   */
  Drupal.AjaxCommands.prototype.setToolbarSubtrees = function (ajax, response, status) {
    Drupal.toolbar.setSubtrees.resolve(response.subtrees);
  };

}(jQuery, Drupal, drupalSettings));
;
/**
 * @file
 * A Backbone Model for collapsible menus.
 */

(function (Backbone, Drupal) {

  'use strict';

  /**
   * Backbone Model for collapsible menus.
   *
   * @constructor
   *
   * @augments Backbone.Model
   */
  Drupal.toolbar.MenuModel = Backbone.Model.extend(/** @lends Drupal.toolbar.MenuModel# */{

    /**
     * @type {object}
     *
     * @prop {object} subtrees
     */
    defaults: /** @lends Drupal.toolbar.MenuModel# */{

      /**
       * @type {object}
       */
      subtrees: {}
    }
  });

}(Backbone, Drupal));
;
/**
 * @file
 * A Backbone Model for the toolbar.
 */

(function (Backbone, Drupal) {

  'use strict';

  /**
   * Backbone model for the toolbar.
   *
   * @constructor
   *
   * @augments Backbone.Model
   */
  Drupal.toolbar.ToolbarModel = Backbone.Model.extend(/** @lends Drupal.toolbar.ToolbarModel# */{

    /**
     * @type {object}
     *
     * @prop activeTab
     * @prop activeTray
     * @prop isOriented
     * @prop isFixed
     * @prop areSubtreesLoaded
     * @prop isViewportOverflowConstrained
     * @prop orientation
     * @prop locked
     * @prop isTrayToggleVisible
     * @prop height
     * @prop offsets
     */
    defaults: /** @lends Drupal.toolbar.ToolbarModel# */{

      /**
       * The active toolbar tab. All other tabs should be inactive under
       * normal circumstances. It will remain active across page loads. The
       * active item is stored as an ID selector e.g. '#toolbar-item--1'.
       *
       * @type {string}
       */
      activeTab: null,

      /**
       * Represents whether a tray is open or not. Stored as an ID selector e.g.
       * '#toolbar-item--1-tray'.
       *
       * @type {string}
       */
      activeTray: null,

      /**
       * Indicates whether the toolbar is displayed in an oriented fashion,
       * either horizontal or vertical.
       *
       * @type {bool}
       */
      isOriented: false,

      /**
       * Indicates whether the toolbar is positioned absolute (false) or fixed
       * (true).
       *
       * @type {bool}
       */
      isFixed: false,

      /**
       * Menu subtrees are loaded through an AJAX request only when the Toolbar
       * is set to a vertical orientation.
       *
       * @type {bool}
       */
      areSubtreesLoaded: false,

      /**
       * If the viewport overflow becomes constrained, isFixed must be true so
       * that elements in the trays aren't lost off-screen and impossible to
       * get to.
       *
       * @type {bool}
       */
      isViewportOverflowConstrained: false,

      /**
       * The orientation of the active tray.
       *
       * @type {string}
       */
      orientation: 'vertical',

      /**
       * A tray is locked if a user toggled it to vertical. Otherwise a tray
       * will switch between vertical and horizontal orientation based on the
       * configured breakpoints. The locked state will be maintained across page
       * loads.
       *
       * @type {bool}
       */
      locked: false,

      /**
       * Indicates whether the tray orientation toggle is visible.
       *
       * @type {bool}
       */
      isTrayToggleVisible: false,

      /**
       * The height of the toolbar.
       *
       * @type {number}
       */
      height: null,

      /**
       * The current viewport offsets determined by {@link Drupal.displace}. The
       * offsets suggest how a module might position is components relative to
       * the viewport.
       *
       * @type {object}
       *
       * @prop {number} top
       * @prop {number} right
       * @prop {number} bottom
       * @prop {number} left
       */
      offsets: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    },

    /**
     * @inheritdoc
     *
     * @param {object} attributes
     *   Attributes for the toolbar.
     * @param {object} options
     *   Options for the toolbar.
     *
     * @return {string|undefined}
     *   Returns an error message if validation failed.
     */
    validate: function (attributes, options) {
      // Prevent the orientation being set to horizontal if it is locked, unless
      // override has not been passed as an option.
      if (attributes.orientation === 'horizontal' && this.get('locked') && !options.override) {
        return Drupal.t('The toolbar cannot be set to a horizontal orientation when it is locked.');
      }
    }
  });

}(Backbone, Drupal));
;
/**
 * @file
 * A Backbone view for the body element.
 */

(function ($, Drupal, Backbone) {

  'use strict';

  Drupal.toolbar.BodyVisualView = Backbone.View.extend(/** @lends Drupal.toolbar.BodyVisualView# */{

    /**
     * Adjusts the body element with the toolbar position and dimension changes.
     *
     * @constructs
     *
     * @augments Backbone.View
     */
    initialize: function () {
      this.listenTo(this.model, 'change:orientation change:offsets change:activeTray change:isOriented change:isFixed change:isViewportOverflowConstrained', this.render);
    },

    /**
     * @inheritdoc
     */
    render: function () {
      var $body = $('body');
      var orientation = this.model.get('orientation');
      var isOriented = this.model.get('isOriented');
      var isViewportOverflowConstrained = this.model.get('isViewportOverflowConstrained');

      $body
        // We are using JavaScript to control media-query handling for two
        // reasons: (1) Using JavaScript let's us leverage the breakpoint
        // configurations and (2) the CSS is really complex if we try to hide
        // some styling from browsers that don't understand CSS media queries.
        // If we drive the CSS from classes added through JavaScript,
        // then the CSS becomes simpler and more robust.
        .toggleClass('toolbar-vertical', (orientation === 'vertical'))
        .toggleClass('toolbar-horizontal', (isOriented && orientation === 'horizontal'))
        // When the toolbar is fixed, it will not scroll with page scrolling.
        .toggleClass('toolbar-fixed', (isViewportOverflowConstrained || this.model.get('isFixed')))
        // Toggle the toolbar-tray-open class on the body element. The class is
        // applied when a toolbar tray is active. Padding might be applied to
        // the body element to prevent the tray from overlapping content.
        .toggleClass('toolbar-tray-open', !!this.model.get('activeTray'))
        // Apply padding to the top of the body to offset the placement of the
        // toolbar bar element.
        .css('padding-top', this.model.get('offsets').top);
    }
  });

}(jQuery, Drupal, Backbone));
;
/**
 * @file
 * A Backbone view for the collapsible menus.
 */

(function ($, Backbone, Drupal) {

  'use strict';

  Drupal.toolbar.MenuVisualView = Backbone.View.extend(/** @lends Drupal.toolbar.MenuVisualView# */{

    /**
     * Backbone View for collapsible menus.
     *
     * @constructs
     *
     * @augments Backbone.View
     */
    initialize: function () {
      this.listenTo(this.model, 'change:subtrees', this.render);
    },

    /**
     * @inheritdoc
     */
    render: function () {
      var subtrees = this.model.get('subtrees');
      // Add subtrees.
      for (var id in subtrees) {
        if (subtrees.hasOwnProperty(id)) {
          this.$el
            .find('#toolbar-link-' + id)
            .once('toolbar-subtrees')
            .after(subtrees[id]);
        }
      }
      // Render the main menu as a nested, collapsible accordion.
      if ('drupalToolbarMenu' in $.fn) {
        this.$el
          .children('.toolbar-menu')
          .drupalToolbarMenu();
      }
    }
  });

}(jQuery, Backbone, Drupal));
;
/**
 * @file
 * A Backbone view for the aural feedback of the toolbar.
 */

(function (Backbone, Drupal) {

  'use strict';

  Drupal.toolbar.ToolbarAuralView = Backbone.View.extend(/** @lends Drupal.toolbar.ToolbarAuralView# */{

    /**
     * Backbone view for the aural feedback of the toolbar.
     *
     * @constructs
     *
     * @augments Backbone.View
     *
     * @param {object} options
     *   Options for the view.
     * @param {object} options.strings
     *   Various strings to use in the view.
     */
    initialize: function (options) {
      this.strings = options.strings;

      this.listenTo(this.model, 'change:orientation', this.onOrientationChange);
      this.listenTo(this.model, 'change:activeTray', this.onActiveTrayChange);
    },

    /**
     * Announces an orientation change.
     *
     * @param {Drupal.toolbar.ToolbarModel} model
     *   The toolbar model in question.
     * @param {string} orientation
     *   The new value of the orientation attribute in the model.
     */
    onOrientationChange: function (model, orientation) {
      Drupal.announce(Drupal.t('Tray orientation changed to @orientation.', {
        '@orientation': orientation
      }));
    },

    /**
     * Announces a changed active tray.
     *
     * @param {Drupal.toolbar.ToolbarModel} model
     *   The toolbar model in question.
     * @param {HTMLElement} tray
     *   The new value of the tray attribute in the model.
     */
    onActiveTrayChange: function (model, tray) {
      var relevantTray = (tray === null) ? model.previous('activeTray') : tray;
      var action = (tray === null) ? Drupal.t('closed') : Drupal.t('opened');
      var trayNameElement = relevantTray.querySelector('.toolbar-tray-name');
      var text;
      if (trayNameElement !== null) {
        text = Drupal.t('Tray "@tray" @action.', {
          '@tray': trayNameElement.textContent, '@action': action
        });
      }
      else {
        text = Drupal.t('Tray @action.', {'@action': action});
      }
      Drupal.announce(text);
    }
  });

}(Backbone, Drupal));
;
/**
 * @file
 * A Backbone view for the toolbar element. Listens to mouse & touch.
 */

(function ($, Drupal, drupalSettings, Backbone) {

  'use strict';

  Drupal.toolbar.ToolbarVisualView = Backbone.View.extend(/** @lends Drupal.toolbar.ToolbarVisualView# */{

    /**
     * Event map for the `ToolbarVisualView`.
     *
     * @return {object}
     *   A map of events.
     */
    events: function () {
      // Prevents delay and simulated mouse events.
      var touchEndToClick = function (event) {
        event.preventDefault();
        event.target.click();
      };

      return {
        'click .toolbar-bar .toolbar-tab': 'onTabClick',
        'click .toolbar-toggle-orientation button': 'onOrientationToggleClick',
        'touchend .toolbar-bar .toolbar-tab': touchEndToClick,
        'touchend .toolbar-toggle-orientation button': touchEndToClick
      };
    },

    /**
     * Backbone view for the toolbar element. Listens to mouse & touch.
     *
     * @constructs
     *
     * @augments Backbone.View
     *
     * @param {object} options
     *   Options for the view object.
     * @param {object} options.strings
     *   Various strings to use in the view.
     */
    initialize: function (options) {
      this.strings = options.strings;

      this.listenTo(this.model, 'change:activeTab change:orientation change:isOriented change:isTrayToggleVisible', this.render);
      this.listenTo(this.model, 'change:mqMatches', this.onMediaQueryChange);
      this.listenTo(this.model, 'change:offsets', this.adjustPlacement);

      // Add the tray orientation toggles.
      this.$el
        .find('.toolbar-tray .toolbar-lining')
        .append(Drupal.theme('toolbarOrientationToggle'));

      // Trigger an activeTab change so that listening scripts can respond on
      // page load. This will call render.
      this.model.trigger('change:activeTab');
    },

    /**
     * @inheritdoc
     *
     * @return {Drupal.toolbar.ToolbarVisualView}
     *   The `ToolbarVisualView` instance.
     */
    render: function () {
      this.updateTabs();
      this.updateTrayOrientation();
      this.updateBarAttributes();
      // Load the subtrees if the orientation of the toolbar is changed to
      // vertical. This condition responds to the case that the toolbar switches
      // from horizontal to vertical orientation. The toolbar starts in a
      // vertical orientation by default and then switches to horizontal during
      // initialization if the media query conditions are met. Simply checking
      // that the orientation is vertical here would result in the subtrees
      // always being loaded, even when the toolbar initialization ultimately
      // results in a horizontal orientation.
      //
      // @see Drupal.behaviors.toolbar.attach() where admin menu subtrees
      // loading is invoked during initialization after media query conditions
      // have been processed.
      if (this.model.changed.orientation === 'vertical' || this.model.changed.activeTab) {
        this.loadSubtrees();
      }
      // Trigger a recalculation of viewport displacing elements. Use setTimeout
      // to ensure this recalculation happens after changes to visual elements
      // have processed.
      window.setTimeout(function () {
        Drupal.displace(true);
      }, 0);
      return this;
    },

    /**
     * Responds to a toolbar tab click.
     *
     * @param {jQuery.Event} event
     *   The event triggered.
     */
    onTabClick: function (event) {
      // If this tab has a tray associated with it, it is considered an
      // activatable tab.
      if (event.target.hasAttribute('data-toolbar-tray')) {
        var activeTab = this.model.get('activeTab');
        var clickedTab = event.target;

        // Set the event target as the active item if it is not already.
        this.model.set('activeTab', (!activeTab || clickedTab !== activeTab) ? clickedTab : null);

        event.preventDefault();
        event.stopPropagation();
      }
    },

    /**
     * Toggles the orientation of a toolbar tray.
     *
     * @param {jQuery.Event} event
     *   The event triggered.
     */
    onOrientationToggleClick: function (event) {
      var orientation = this.model.get('orientation');
      // Determine the toggle-to orientation.
      var antiOrientation = (orientation === 'vertical') ? 'horizontal' : 'vertical';
      var locked = antiOrientation === 'vertical';
      // Remember the locked state.
      if (locked) {
        localStorage.setItem('Drupal.toolbar.trayVerticalLocked', 'true');
      }
      else {
        localStorage.removeItem('Drupal.toolbar.trayVerticalLocked');
      }
      // Update the model.
      this.model.set({
        locked: locked,
        orientation: antiOrientation
      }, {
        validate: true,
        override: true
      });

      event.preventDefault();
      event.stopPropagation();
    },

    /**
     * Updates the display of the tabs: toggles a tab and the associated tray.
     */
    updateTabs: function () {
      var $tab = $(this.model.get('activeTab'));
      // Deactivate the previous tab.
      $(this.model.previous('activeTab'))
        .removeClass('is-active')
        .prop('aria-pressed', false);
      // Deactivate the previous tray.
      $(this.model.previous('activeTray'))
        .removeClass('is-active');

      // Activate the selected tab.
      if ($tab.length > 0) {
        $tab
          .addClass('is-active')
          // Mark the tab as pressed.
          .prop('aria-pressed', true);
        var name = $tab.attr('data-toolbar-tray');
        // Store the active tab name or remove the setting.
        var id = $tab.get(0).id;
        if (id) {
          localStorage.setItem('Drupal.toolbar.activeTabID', JSON.stringify(id));
        }
        // Activate the associated tray.
        var $tray = this.$el.find('[data-toolbar-tray="' + name + '"].toolbar-tray');
        if ($tray.length) {
          $tray.addClass('is-active');
          this.model.set('activeTray', $tray.get(0));
        }
        else {
          // There is no active tray.
          this.model.set('activeTray', null);
        }
      }
      else {
        // There is no active tray.
        this.model.set('activeTray', null);
        localStorage.removeItem('Drupal.toolbar.activeTabID');
      }
    },

    /**
     * Update the attributes of the toolbar bar element.
     */
    updateBarAttributes: function () {
      var isOriented = this.model.get('isOriented');
      if (isOriented) {
        this.$el.find('.toolbar-bar').attr('data-offset-top', '');
      }
      else {
        this.$el.find('.toolbar-bar').removeAttr('data-offset-top');
      }
      // Toggle between a basic vertical view and a more sophisticated
      // horizontal and vertical display of the toolbar bar and trays.
      this.$el.toggleClass('toolbar-oriented', isOriented);
    },

    /**
     * Updates the orientation of the active tray if necessary.
     */
    updateTrayOrientation: function () {
      var orientation = this.model.get('orientation');
      // The antiOrientation is used to render the view of action buttons like
      // the tray orientation toggle.
      var antiOrientation = (orientation === 'vertical') ? 'horizontal' : 'vertical';
      // Update the orientation of the trays.
      var $trays = this.$el.find('.toolbar-tray')
        .removeClass('toolbar-tray-horizontal toolbar-tray-vertical')
        .addClass('toolbar-tray-' + orientation);

      // Update the tray orientation toggle button.
      var iconClass = 'toolbar-icon-toggle-' + orientation;
      var iconAntiClass = 'toolbar-icon-toggle-' + antiOrientation;
      var $orientationToggle = this.$el.find('.toolbar-toggle-orientation')
        .toggle(this.model.get('isTrayToggleVisible'));
      $orientationToggle.find('button')
        .val(antiOrientation)
        .attr('title', this.strings[antiOrientation])
        .text(this.strings[antiOrientation])
        .removeClass(iconClass)
        .addClass(iconAntiClass);

      // Update data offset attributes for the trays.
      var dir = document.documentElement.dir;
      var edge = (dir === 'rtl') ? 'right' : 'left';
      // Remove data-offset attributes from the trays so they can be refreshed.
      $trays.removeAttr('data-offset-left data-offset-right data-offset-top');
      // If an active vertical tray exists, mark it as an offset element.
      $trays.filter('.toolbar-tray-vertical.is-active').attr('data-offset-' + edge, '');
      // If an active horizontal tray exists, mark it as an offset element.
      $trays.filter('.toolbar-tray-horizontal.is-active').attr('data-offset-top', '');
    },

    /**
     * Sets the tops of the trays so that they align with the bottom of the bar.
     */
    adjustPlacement: function () {
      var $trays = this.$el.find('.toolbar-tray');
      if (!this.model.get('isOriented')) {
        $trays.css('margin-top', 0);
        $trays.removeClass('toolbar-tray-horizontal').addClass('toolbar-tray-vertical');
      }
      else {
        // The toolbar container is invisible. Its placement is used to
        // determine the container for the trays.
        $trays.css('margin-top', this.$el.find('.toolbar-bar').outerHeight());
      }
    },

    /**
     * Calls the endpoint URI that builds an AJAX command with the rendered
     * subtrees.
     *
     * The rendered admin menu subtrees HTML is cached on the client in
     * localStorage until the cache of the admin menu subtrees on the server-
     * side is invalidated. The subtreesHash is stored in localStorage as well
     * and compared to the subtreesHash in drupalSettings to determine when the
     * admin menu subtrees cache has been invalidated.
     */
    loadSubtrees: function () {
      var $activeTab = $(this.model.get('activeTab'));
      var orientation = this.model.get('orientation');
      // Only load and render the admin menu subtrees if:
      //   (1) They have not been loaded yet.
      //   (2) The active tab is the administration menu tab, indicated by the
      //       presence of the data-drupal-subtrees attribute.
      //   (3) The orientation of the tray is vertical.
      if (!this.model.get('areSubtreesLoaded') && typeof $activeTab.data('drupal-subtrees') !== 'undefined' && orientation === 'vertical') {
        var subtreesHash = drupalSettings.toolbar.subtreesHash;
        var theme = drupalSettings.ajaxPageState.theme;
        var endpoint = Drupal.url('toolbar/subtrees/' + subtreesHash);
        var cachedSubtreesHash = localStorage.getItem('Drupal.toolbar.subtreesHash.' + theme);
        var cachedSubtrees = JSON.parse(localStorage.getItem('Drupal.toolbar.subtrees.' + theme));
        var isVertical = this.model.get('orientation') === 'vertical';
        // If we have the subtrees in localStorage and the subtree hash has not
        // changed, then use the cached data.
        if (isVertical && subtreesHash === cachedSubtreesHash && cachedSubtrees) {
          Drupal.toolbar.setSubtrees.resolve(cachedSubtrees);
        }
        // Only make the call to get the subtrees if the orientation of the
        // toolbar is vertical.
        else if (isVertical) {
          // Remove the cached menu information.
          localStorage.removeItem('Drupal.toolbar.subtreesHash.' + theme);
          localStorage.removeItem('Drupal.toolbar.subtrees.' + theme);
          // The AJAX response's command will trigger the resolve method of the
          // Drupal.toolbar.setSubtrees Promise.
          Drupal.ajax({url: endpoint}).execute();
          // Cache the hash for the subtrees locally.
          localStorage.setItem('Drupal.toolbar.subtreesHash.' + theme, subtreesHash);
        }
      }
    }
  });

}(jQuery, Drupal, drupalSettings, Backbone));
;
/* jQuery Foundation Joyride Plugin 2.1 | Copyright 2012, ZURB | www.opensource.org/licenses/mit-license.php */
(function(e,t,n){"use strict";var r={version:"2.0.3",tipLocation:"bottom",nubPosition:"auto",scroll:!0,scrollSpeed:300,timer:0,autoStart:!1,startTimerOnClick:!0,startOffset:0,nextButton:!0,tipAnimation:"fade",pauseAfter:[],tipAnimationFadeSpeed:300,cookieMonster:!1,cookieName:"joyride",cookieDomain:!1,cookiePath:!1,localStorage:!1,localStorageKey:"joyride",tipContainer:"body",modal:!1,expose:!1,postExposeCallback:e.noop,preRideCallback:e.noop,postRideCallback:e.noop,preStepCallback:e.noop,postStepCallback:e.noop,template:{link:'<a href="#close" class="joyride-close-tip">X</a>',timer:'<div class="joyride-timer-indicator-wrap"><span class="joyride-timer-indicator"></span></div>',tip:'<div class="joyride-tip-guide"><span class="joyride-nub"></span></div>',wrapper:'<div class="joyride-content-wrapper" role="dialog"></div>',button:'<a href="#" class="joyride-next-tip"></a>',modal:'<div class="joyride-modal-bg"></div>',expose:'<div class="joyride-expose-wrapper"></div>',exposeCover:'<div class="joyride-expose-cover"></div>'}},i=i||!1,s={},o={init:function(n){return this.each(function(){e.isEmptyObject(s)?(s=e.extend(!0,r,n),s.document=t.document,s.$document=e(s.document),s.$window=e(t),s.$content_el=e(this),s.$body=e(s.tipContainer),s.body_offset=e(s.tipContainer).position(),s.$tip_content=e("> li",s.$content_el),s.paused=!1,s.attempts=0,s.tipLocationPatterns={top:["bottom"],bottom:[],left:["right","top","bottom"],right:["left","top","bottom"]},o.jquery_check(),e.isFunction(e.cookie)||(s.cookieMonster=!1),(!s.cookieMonster||!e.cookie(s.cookieName))&&(!s.localStorage||!o.support_localstorage()||!localStorage.getItem(s.localStorageKey))&&(s.$tip_content.each(function(t){o.create({$li:e(this),index:t})}),s.autoStart&&(!s.startTimerOnClick&&s.timer>0?(o.show("init"),o.startTimer()):o.show("init"))),s.$document.on("click.joyride",".joyride-next-tip, .joyride-modal-bg",function(e){e.preventDefault(),s.$li.next().length<1?o.end():s.timer>0?(clearTimeout(s.automate),o.hide(),o.show(),o.startTimer()):(o.hide(),o.show())}),s.$document.on("click.joyride",".joyride-close-tip",function(e){e.preventDefault(),o.end()}),s.$window.bind("resize.joyride",function(t){if(s.$li){if(s.exposed&&s.exposed.length>0){var n=e(s.exposed);n.each(function(){var t=e(this);o.un_expose(t),o.expose(t)})}o.is_phone()?o.pos_phone():o.pos_default()}})):o.restart()})},resume:function(){o.set_li(),o.show()},nextTip:function(){s.$li.next().length<1?o.end():s.timer>0?(clearTimeout(s.automate),o.hide(),o.show(),o.startTimer()):(o.hide(),o.show())},tip_template:function(t){var n,r,i;return t.tip_class=t.tip_class||"",n=e(s.template.tip).addClass(t.tip_class),r=e.trim(e(t.li).html())+o.button_text(t.button_text)+s.template.link+o.timer_instance(t.index),i=e(s.template.wrapper),t.li.attr("data-aria-labelledby")&&i.attr("aria-labelledby",t.li.attr("data-aria-labelledby")),t.li.attr("data-aria-describedby")&&i.attr("aria-describedby",t.li.attr("data-aria-describedby")),n.append(i),n.first().attr("data-index",t.index),e(".joyride-content-wrapper",n).append(r),n[0]},timer_instance:function(t){var n;return t===0&&s.startTimerOnClick&&s.timer>0||s.timer===0?n="":n=o.outerHTML(e(s.template.timer)[0]),n},button_text:function(t){return s.nextButton?(t=e.trim(t)||"Next",t=o.outerHTML(e(s.template.button).append(t)[0])):t="",t},create:function(t){var n=t.$li.attr("data-button")||t.$li.attr("data-text"),r=t.$li.attr("class"),i=e(o.tip_template({tip_class:r,index:t.index,button_text:n,li:t.$li}));e(s.tipContainer).append(i)},show:function(t){var r={},i,u=[],a=0,f,l=null;if(s.$li===n||e.inArray(s.$li.index(),s.pauseAfter)===-1){s.paused?s.paused=!1:o.set_li(t),s.attempts=0;if(s.$li.length&&s.$target.length>0){t&&(s.preRideCallback(s.$li.index(),s.$next_tip),s.modal&&o.show_modal()),s.preStepCallback(s.$li.index(),s.$next_tip),u=(s.$li.data("options")||":").split(";"),a=u.length;for(i=a-1;i>=0;i--)f=u[i].split(":"),f.length===2&&(r[e.trim(f[0])]=e.trim(f[1]));s.tipSettings=e.extend({},s,r),s.tipSettings.tipLocationPattern=s.tipLocationPatterns[s.tipSettings.tipLocation],s.modal&&s.expose&&o.expose(),!/body/i.test(s.$target.selector)&&s.scroll&&o.scroll_to(),o.is_phone()?o.pos_phone(!0):o.pos_default(!0),l=e(".joyride-timer-indicator",s.$next_tip),/pop/i.test(s.tipAnimation)?(l.outerWidth(0),s.timer>0?(s.$next_tip.show(),l.animate({width:e(".joyride-timer-indicator-wrap",s.$next_tip).outerWidth()},s.timer)):s.$next_tip.show()):/fade/i.test(s.tipAnimation)&&(l.outerWidth(0),s.timer>0?(s.$next_tip.fadeIn(s.tipAnimationFadeSpeed),s.$next_tip.show(),l.animate({width:e(".joyride-timer-indicator-wrap",s.$next_tip).outerWidth()},s.timer)):s.$next_tip.fadeIn(s.tipAnimationFadeSpeed)),s.$current_tip=s.$next_tip,e(".joyride-next-tip",s.$current_tip).focus(),o.tabbable(s.$current_tip)}else s.$li&&s.$target.length<1?o.show():o.end()}else s.paused=!0},is_phone:function(){return i?i.mq("only screen and (max-width: 767px)"):s.$window.width()<767?!0:!1},support_localstorage:function(){return i?i.localstorage:!!t.localStorage},hide:function(){s.modal&&s.expose&&o.un_expose(),s.modal||e(".joyride-modal-bg").hide(),s.$current_tip.hide(),s.postStepCallback(s.$li.index(),s.$current_tip)},set_li:function(e){e?(s.$li=s.$tip_content.eq(s.startOffset),o.set_next_tip(),s.$current_tip=s.$next_tip):(s.$li=s.$li.next(),o.set_next_tip()),o.set_target()},set_next_tip:function(){s.$next_tip=e(".joyride-tip-guide[data-index="+s.$li.index()+"]")},set_target:function(){var t=s.$li.attr("data-class"),n=s.$li.attr("data-id"),r=function(){return n?e(s.document.getElementById(n)):t?e("."+t).filter(":visible").first():e("body")};s.$target=r()},scroll_to:function(){var t,n;t=s.$window.height()/2,n=Math.ceil(s.$target.offset().top-t+s.$next_tip.outerHeight()),e("html, body").stop().animate({scrollTop:n},s.scrollSpeed)},paused:function(){return e.inArray(s.$li.index()+1,s.pauseAfter)===-1?!0:!1},destroy:function(){e.isEmptyObject(s)||s.$document.off(".joyride"),e(t).off(".joyride"),e(".joyride-close-tip, .joyride-next-tip, .joyride-modal-bg").off(".joyride"),e(".joyride-tip-guide, .joyride-modal-bg").remove(),clearTimeout(s.automate),s={}},restart:function(){s.autoStart?(o.hide(),s.$li=n,o.show("init")):(!s.startTimerOnClick&&s.timer>0?(o.show("init"),o.startTimer()):o.show("init"),s.autoStart=!0)},pos_default:function(t){var n=Math.ceil(s.$window.height()/2),r=s.$next_tip.offset(),i=e(".joyride-nub",s.$next_tip),u=Math.ceil(i.outerWidth()/2),a=Math.ceil(i.outerHeight()/2),f=t||!1;f&&(s.$next_tip.css("visibility","hidden"),s.$next_tip.show());if(!/body/i.test(s.$target.selector)){var l=s.tipSettings.tipAdjustmentY?parseInt(s.tipSettings.tipAdjustmentY):0,c=s.tipSettings.tipAdjustmentX?parseInt(s.tipSettings.tipAdjustmentX):0;o.bottom()?(s.$next_tip.css({top:s.$target.offset().top+a+s.$target.outerHeight()+l,left:s.$target.offset().left+c}),/right/i.test(s.tipSettings.nubPosition)&&s.$next_tip.css("left",s.$target.offset().left-s.$next_tip.outerWidth()+s.$target.outerWidth()),o.nub_position(i,s.tipSettings.nubPosition,"top")):o.top()?(s.$next_tip.css({top:s.$target.offset().top-s.$next_tip.outerHeight()-a+l,left:s.$target.offset().left+c}),o.nub_position(i,s.tipSettings.nubPosition,"bottom")):o.right()?(s.$next_tip.css({top:s.$target.offset().top+l,left:s.$target.outerWidth()+s.$target.offset().left+u+c}),o.nub_position(i,s.tipSettings.nubPosition,"left")):o.left()&&(s.$next_tip.css({top:s.$target.offset().top+l,left:s.$target.offset().left-s.$next_tip.outerWidth()-u+c}),o.nub_position(i,s.tipSettings.nubPosition,"right")),!o.visible(o.corners(s.$next_tip))&&s.attempts<s.tipSettings.tipLocationPattern.length&&(i.removeClass("bottom").removeClass("top").removeClass("right").removeClass("left"),s.tipSettings.tipLocation=s.tipSettings.tipLocationPattern[s.attempts],s.attempts++,o.pos_default(!0))}else s.$li.length&&o.pos_modal(i);f&&(s.$next_tip.hide(),s.$next_tip.css("visibility","visible"))},pos_phone:function(t){var n=s.$next_tip.outerHeight(),r=s.$next_tip.offset(),i=s.$target.outerHeight(),u=e(".joyride-nub",s.$next_tip),a=Math.ceil(u.outerHeight()/2),f=t||!1;u.removeClass("bottom").removeClass("top").removeClass("right").removeClass("left"),f&&(s.$next_tip.css("visibility","hidden"),s.$next_tip.show()),/body/i.test(s.$target.selector)?s.$li.length&&o.pos_modal(u):o.top()?(s.$next_tip.offset({top:s.$target.offset().top-n-a}),u.addClass("bottom")):(s.$next_tip.offset({top:s.$target.offset().top+i+a}),u.addClass("top")),f&&(s.$next_tip.hide(),s.$next_tip.css("visibility","visible"))},pos_modal:function(e){o.center(),e.hide(),o.show_modal()},show_modal:function(){e(".joyride-modal-bg").length<1&&e("body").append(s.template.modal).show(),/pop/i.test(s.tipAnimation)?e(".joyride-modal-bg").show():e(".joyride-modal-bg").fadeIn(s.tipAnimationFadeSpeed)},expose:function(){var n,r,i,u,a="expose-"+Math.floor(Math.random()*1e4);if(arguments.length>0&&arguments[0]instanceof e)i=arguments[0];else{if(!s.$target||!!/body/i.test(s.$target.selector))return!1;i=s.$target}if(i.length<1)return t.console&&console.error("element not valid",i),!1;n=e(s.template.expose),s.$body.append(n),n.css({top:i.offset().top,left:i.offset().left,width:i.outerWidth(!0),height:i.outerHeight(!0)}),r=e(s.template.exposeCover),u={zIndex:i.css("z-index"),position:i.css("position")},i.css("z-index",n.css("z-index")*1+1),u.position=="static"&&i.css("position","relative"),i.data("expose-css",u),r.css({top:i.offset().top,left:i.offset().left,width:i.outerWidth(!0),height:i.outerHeight(!0)}),s.$body.append(r),n.addClass(a),r.addClass(a),s.tipSettings.exposeClass&&(n.addClass(s.tipSettings.exposeClass),r.addClass(s.tipSettings.exposeClass)),i.data("expose",a),s.postExposeCallback(s.$li.index(),s.$next_tip,i),o.add_exposed(i)},un_expose:function(){var n,r,i,u,a=!1;if(arguments.length>0&&arguments[0]instanceof e)r=arguments[0];else{if(!s.$target||!!/body/i.test(s.$target.selector))return!1;r=s.$target}if(r.length<1)return t.console&&console.error("element not valid",r),!1;n=r.data("expose"),i=e("."+n),arguments.length>1&&(a=arguments[1]),a===!0?e(".joyride-expose-wrapper,.joyride-expose-cover").remove():i.remove(),u=r.data("expose-css"),u.zIndex=="auto"?r.css("z-index",""):r.css("z-index",u.zIndex),u.position!=r.css("position")&&(u.position=="static"?r.css("position",""):r.css("position",u.position)),r.removeData("expose"),r.removeData("expose-z-index"),o.remove_exposed(r)},add_exposed:function(t){s.exposed=s.exposed||[],t instanceof e?s.exposed.push(t[0]):typeof t=="string"&&s.exposed.push(t)},remove_exposed:function(t){var n;t instanceof e?n=t[0]:typeof t=="string"&&(n=t),s.exposed=s.exposed||[];for(var r=0;r<s.exposed.length;r++)if(s.exposed[r]==n){s.exposed.splice(r,1);return}},center:function(){var e=s.$window;return s.$next_tip.css({top:(e.height()-s.$next_tip.outerHeight())/2+e.scrollTop(),left:(e.width()-s.$next_tip.outerWidth())/2+e.scrollLeft()}),!0},bottom:function(){return/bottom/i.test(s.tipSettings.tipLocation)},top:function(){return/top/i.test(s.tipSettings.tipLocation)},right:function(){return/right/i.test(s.tipSettings.tipLocation)},left:function(){return/left/i.test(s.tipSettings.tipLocation)},corners:function(e){var t=s.$window,n=t.height()/2,r=Math.ceil(s.$target.offset().top-n+s.$next_tip.outerHeight()),i=t.width()+t.scrollLeft(),o=t.height()+r,u=t.height()+t.scrollTop(),a=t.scrollTop();return r<a&&(r<0?a=0:a=r),o>u&&(u=o),[e.offset().top<a,i<e.offset().left+e.outerWidth(),u<e.offset().top+e.outerHeight(),t.scrollLeft()>e.offset().left]},visible:function(e){var t=e.length;while(t--)if(e[t])return!1;return!0},nub_position:function(e,t,n){t==="auto"?e.addClass(n):e.addClass(t)},startTimer:function(){s.$li.length?s.automate=setTimeout(function(){o.hide(),o.show(),o.startTimer()},s.timer):clearTimeout(s.automate)},end:function(){s.cookieMonster&&e.cookie(s.cookieName,"ridden",{expires:365,domain:s.cookieDomain,path:s.cookiePath}),s.localStorage&&localStorage.setItem(s.localStorageKey,!0),s.timer>0&&clearTimeout(s.automate),s.modal&&s.expose&&o.un_expose(),s.$current_tip&&s.$current_tip.hide(),s.$li&&(s.postStepCallback(s.$li.index(),s.$current_tip),s.postRideCallback(s.$li.index(),s.$current_tip)),e(".joyride-modal-bg").hide()},jquery_check:function(){return e.isFunction(e.fn.on)?!0:(e.fn.on=function(e,t,n){return this.delegate(t,e,n)},e.fn.off=function(e,t,n){return this.undelegate(t,e,n)},!1)},outerHTML:function(e){return e.outerHTML||(new XMLSerializer).serializeToString(e)},version:function(){return s.version},tabbable:function(t){e(t).on("keydown",function(n){if(!n.isDefaultPrevented()&&n.keyCode&&n.keyCode===27){n.preventDefault(),o.end();return}if(n.keyCode!==9)return;var r=e(t).find(":tabbable"),i=r.filter(":first"),s=r.filter(":last");n.target===s[0]&&!n.shiftKey?(i.focus(1),n.preventDefault()):n.target===i[0]&&n.shiftKey&&(s.focus(1),n.preventDefault())})}};e.fn.joyride=function(t){if(o[t])return o[t].apply(this,Array.prototype.slice.call(arguments,1));if(typeof t=="object"||!t)return o.init.apply(this,arguments);e.error("Method "+t+" does not exist on jQuery.joyride")}})(jQuery,this);
;
/**
 * @file
 * Attaches behaviors for the Tour module's toolbar tab.
 */

(function ($, Backbone, Drupal, document) {

  'use strict';

  var queryString = decodeURI(window.location.search);

  /**
   * Attaches the tour's toolbar tab behavior.
   *
   * It uses the query string for:
   * - tour: When ?tour=1 is present, the tour will start automatically after
   *   the page has loaded.
   * - tips: Pass ?tips=class in the url to filter the available tips to the
   *   subset which match the given class.
   *
   * @example
   * http://example.com/foo?tour=1&tips=bar
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attach tour functionality on `tour` events.
   */
  Drupal.behaviors.tour = {
    attach: function (context) {
      $('body').once('tour').each(function () {
        var model = new Drupal.tour.models.StateModel();
        new Drupal.tour.views.ToggleTourView({
          el: $(context).find('#toolbar-tab-tour'),
          model: model
        });

        model
          // Allow other scripts to respond to tour events.
          .on('change:isActive', function (model, isActive) {
            $(document).trigger((isActive) ? 'drupalTourStarted' : 'drupalTourStopped');
          })
          // Initialization: check whether a tour is available on the current
          // page.
          .set('tour', $(context).find('ol#tour'));

        // Start the tour immediately if toggled via query string.
        if (/tour=?/i.test(queryString)) {
          model.set('isActive', true);
        }
      });
    }
  };

  /**
   * @namespace
   */
  Drupal.tour = Drupal.tour || {

    /**
     * @namespace Drupal.tour.models
     */
    models: {},

    /**
     * @namespace Drupal.tour.views
     */
    views: {}
  };

  /**
   * Backbone Model for tours.
   *
   * @constructor
   *
   * @augments Backbone.Model
   */
  Drupal.tour.models.StateModel = Backbone.Model.extend(/** @lends Drupal.tour.models.StateModel# */{

    /**
     * @type {object}
     */
    defaults: /** @lends Drupal.tour.models.StateModel# */{

      /**
       * Indicates whether the Drupal root window has a tour.
       *
       * @type {Array}
       */
      tour: [],

      /**
       * Indicates whether the tour is currently running.
       *
       * @type {bool}
       */
      isActive: false,

      /**
       * Indicates which tour is the active one (necessary to cleanly stop).
       *
       * @type {Array}
       */
      activeTour: []
    }
  });

  Drupal.tour.views.ToggleTourView = Backbone.View.extend(/** @lends Drupal.tour.views.ToggleTourView# */{

    /**
     * @type {object}
     */
    events: {click: 'onClick'},

    /**
     * Handles edit mode toggle interactions.
     *
     * @constructs
     *
     * @augments Backbone.View
     */
    initialize: function () {
      this.listenTo(this.model, 'change:tour change:isActive', this.render);
      this.listenTo(this.model, 'change:isActive', this.toggleTour);
    },

    /**
     * @inheritdoc
     *
     * @return {Drupal.tour.views.ToggleTourView}
     *   The `ToggleTourView` view.
     */
    render: function () {
      // Render the visibility.
      this.$el.toggleClass('hidden', this._getTour().length === 0);
      // Render the state.
      var isActive = this.model.get('isActive');
      this.$el.find('button')
        .toggleClass('is-active', isActive)
        .prop('aria-pressed', isActive);
      return this;
    },

    /**
     * Model change handler; starts or stops the tour.
     */
    toggleTour: function () {
      if (this.model.get('isActive')) {
        var $tour = this._getTour();
        this._removeIrrelevantTourItems($tour, this._getDocument());
        var that = this;
        if ($tour.find('li').length) {
          $tour.joyride({
            autoStart: true,
            postRideCallback: function () { that.model.set('isActive', false); },
            // HTML segments for tip layout.
            template: {
              link: '<a href=\"#close\" class=\"joyride-close-tip\">&times;</a>',
              button: '<a href=\"#\" class=\"button button--primary joyride-next-tip\"></a>'
            }
          });
          this.model.set({isActive: true, activeTour: $tour});
        }
      }
      else {
        this.model.get('activeTour').joyride('destroy');
        this.model.set({isActive: false, activeTour: []});
      }
    },

    /**
     * Toolbar tab click event handler; toggles isActive.
     *
     * @param {jQuery.Event} event
     *   The click event.
     */
    onClick: function (event) {
      this.model.set('isActive', !this.model.get('isActive'));
      event.preventDefault();
      event.stopPropagation();
    },

    /**
     * Gets the tour.
     *
     * @return {jQuery}
     *   A jQuery element pointing to a `<ol>` containing tour items.
     */
    _getTour: function () {
      return this.model.get('tour');
    },

    /**
     * Gets the relevant document as a jQuery element.
     *
     * @return {jQuery}
     *   A jQuery element pointing to the document within which a tour would be
     *   started given the current state.
     */
    _getDocument: function () {
      return $(document);
    },

    /**
     * Removes tour items for elements that don't have matching page elements.
     *
     * Or that are explicitly filtered out via the 'tips' query string.
     *
     * @example
     * <caption>This will filter out tips that do not have a matching
     * page element or don't have the "bar" class.</caption>
     * http://example.com/foo?tips=bar
     *
     * @param {jQuery} $tour
     *   A jQuery element pointing to a `<ol>` containing tour items.
     * @param {jQuery} $document
     *   A jQuery element pointing to the document within which the elements
     *   should be sought.
     *
     * @see Drupal.tour.views.ToggleTourView#_getDocument
     */
    _removeIrrelevantTourItems: function ($tour, $document) {
      var removals = false;
      var tips = /tips=([^&]+)/.exec(queryString);
      $tour
        .find('li')
        .each(function () {
          var $this = $(this);
          var itemId = $this.attr('data-id');
          var itemClass = $this.attr('data-class');
          // If the query parameter 'tips' is set, remove all tips that don't
          // have the matching class.
          if (tips && !$(this).hasClass(tips[1])) {
            removals = true;
            $this.remove();
            return;
          }
          // Remove tip from the DOM if there is no corresponding page element.
          if ((!itemId && !itemClass) ||
            (itemId && $document.find('#' + itemId).length) ||
            (itemClass && $document.find('.' + itemClass).length)) {
            return;
          }
          removals = true;
          $this.remove();
        });

      // If there were removals, we'll have to do some clean-up.
      if (removals) {
        var total = $tour.find('li').length;
        if (!total) {
          this.model.set({tour: []});
        }

        $tour
          .find('li')
          // Rebuild the progress data.
          .each(function (index) {
            var progress = Drupal.t('!tour_item of !total', {'!tour_item': index + 1, '!total': total});
            $(this).find('.tour-progress').text(progress);
          })
          // Update the last item to have "End tour" as the button.
          .eq(-1)
          .attr('data-text', Drupal.t('End tour'));
      }
    }

  });

})(jQuery, Backbone, Drupal, document);
;
/**
 * @file
 * Manages page tabbing modifications made by modules.
 */

/**
 * Allow modules to respond to the constrain event.
 *
 * @event drupalTabbingConstrained
 */

/**
 * Allow modules to respond to the tabbingContext release event.
 *
 * @event drupalTabbingContextReleased
 */

/**
 * Allow modules to respond to the constrain event.
 *
 * @event drupalTabbingContextActivated
 */

/**
 * Allow modules to respond to the constrain event.
 *
 * @event drupalTabbingContextDeactivated
 */

(function ($, Drupal) {

  'use strict';

  /**
   * Provides an API for managing page tabbing order modifications.
   *
   * @constructor Drupal~TabbingManager
   */
  function TabbingManager() {

    /**
     * Tabbing sets are stored as a stack. The active set is at the top of the
     * stack. We use a JavaScript array as if it were a stack; we consider the
     * first element to be the bottom and the last element to be the top. This
     * allows us to use JavaScript's built-in Array.push() and Array.pop()
     * methods.
     *
     * @type {Array.<Drupal~TabbingContext>}
     */
    this.stack = [];
  }

  /**
   * Add public methods to the TabbingManager class.
   */
  $.extend(TabbingManager.prototype, /** @lends Drupal~TabbingManager# */{

    /**
     * Constrain tabbing to the specified set of elements only.
     *
     * Makes elements outside of the specified set of elements unreachable via
     * the tab key.
     *
     * @param {jQuery} elements
     *   The set of elements to which tabbing should be constrained. Can also
     *   be a jQuery-compatible selector string.
     *
     * @return {Drupal~TabbingContext}
     *   The TabbingContext instance.
     *
     * @fires event:drupalTabbingConstrained
     */
    constrain: function (elements) {
      // Deactivate all tabbingContexts to prepare for the new constraint. A
      // tabbingContext instance will only be reactivated if the stack is
      // unwound to it in the _unwindStack() method.
      var il = this.stack.length;
      for (var i = 0; i < il; i++) {
        this.stack[i].deactivate();
      }

      // The "active tabbing set" are the elements tabbing should be constrained
      // to.
      var $elements = $(elements).find(':tabbable').addBack(':tabbable');

      var tabbingContext = new TabbingContext({
        // The level is the current height of the stack before this new
        // tabbingContext is pushed on top of the stack.
        level: this.stack.length,
        $tabbableElements: $elements
      });

      this.stack.push(tabbingContext);

      // Activates the tabbingContext; this will manipulate the DOM to constrain
      // tabbing.
      tabbingContext.activate();

      // Allow modules to respond to the constrain event.
      $(document).trigger('drupalTabbingConstrained', tabbingContext);

      return tabbingContext;
    },

    /**
     * Restores a former tabbingContext when an active one is released.
     *
     * The TabbingManager stack of tabbingContext instances will be unwound
     * from the top-most released tabbingContext down to the first non-released
     * tabbingContext instance. This non-released instance is then activated.
     */
    release: function () {
      // Unwind as far as possible: find the topmost non-released
      // tabbingContext.
      var toActivate = this.stack.length - 1;
      while (toActivate >= 0 && this.stack[toActivate].released) {
        toActivate--;
      }

      // Delete all tabbingContexts after the to be activated one. They have
      // already been deactivated, so their effect on the DOM has been reversed.
      this.stack.splice(toActivate + 1);

      // Get topmost tabbingContext, if one exists, and activate it.
      if (toActivate >= 0) {
        this.stack[toActivate].activate();
      }
    },

    /**
     * Makes all elements outside of the tabbingContext's set untabbable.
     *
     * Elements made untabbable have their original tabindex and autofocus
     * values stored so that they might be restored later when this
     * tabbingContext is deactivated.
     *
     * @param {Drupal~TabbingContext} tabbingContext
     *   The TabbingContext instance that has been activated.
     */
    activate: function (tabbingContext) {
      var $set = tabbingContext.$tabbableElements;
      var level = tabbingContext.level;
      // Determine which elements are reachable via tabbing by default.
      var $disabledSet = $(':tabbable')
        // Exclude elements of the active tabbing set.
        .not($set);
      // Set the disabled set on the tabbingContext.
      tabbingContext.$disabledElements = $disabledSet;
      // Record the tabindex for each element, so we can restore it later.
      var il = $disabledSet.length;
      for (var i = 0; i < il; i++) {
        this.recordTabindex($disabledSet.eq(i), level);
      }
      // Make all tabbable elements outside of the active tabbing set
      // unreachable.
      $disabledSet
        .prop('tabindex', -1)
        .prop('autofocus', false);

      // Set focus on an element in the tabbingContext's set of tabbable
      // elements. First, check if there is an element with an autofocus
      // attribute. Select the last one from the DOM order.
      var $hasFocus = $set.filter('[autofocus]').eq(-1);
      // If no element in the tabbable set has an autofocus attribute, select
      // the first element in the set.
      if ($hasFocus.length === 0) {
        $hasFocus = $set.eq(0);
      }
      $hasFocus.trigger('focus');
    },

    /**
     * Restores that tabbable state of a tabbingContext's disabled elements.
     *
     * Elements that were made untabbable have their original tabindex and
     * autofocus values restored.
     *
     * @param {Drupal~TabbingContext} tabbingContext
     *   The TabbingContext instance that has been deactivated.
     */
    deactivate: function (tabbingContext) {
      var $set = tabbingContext.$disabledElements;
      var level = tabbingContext.level;
      var il = $set.length;
      for (var i = 0; i < il; i++) {
        this.restoreTabindex($set.eq(i), level);
      }
    },

    /**
     * Records the tabindex and autofocus values of an untabbable element.
     *
     * @param {jQuery} $el
     *   The set of elements that have been disabled.
     * @param {number} level
     *   The stack level for which the tabindex attribute should be recorded.
     */
    recordTabindex: function ($el, level) {
      var tabInfo = $el.data('drupalOriginalTabIndices') || {};
      tabInfo[level] = {
        tabindex: $el[0].getAttribute('tabindex'),
        autofocus: $el[0].hasAttribute('autofocus')
      };
      $el.data('drupalOriginalTabIndices', tabInfo);
    },

    /**
     * Restores the tabindex and autofocus values of a reactivated element.
     *
     * @param {jQuery} $el
     *   The element that is being reactivated.
     * @param {number} level
     *   The stack level for which the tabindex attribute should be restored.
     */
    restoreTabindex: function ($el, level) {
      var tabInfo = $el.data('drupalOriginalTabIndices');
      if (tabInfo && tabInfo[level]) {
        var data = tabInfo[level];
        if (data.tabindex) {
          $el[0].setAttribute('tabindex', data.tabindex);
        }
        // If the element did not have a tabindex at this stack level then
        // remove it.
        else {
          $el[0].removeAttribute('tabindex');
        }
        if (data.autofocus) {
          $el[0].setAttribute('autofocus', 'autofocus');
        }

        // Clean up $.data.
        if (level === 0) {
          // Remove all data.
          $el.removeData('drupalOriginalTabIndices');
        }
        else {
          // Remove the data for this stack level and higher.
          var levelToDelete = level;
          while (tabInfo.hasOwnProperty(levelToDelete)) {
            delete tabInfo[levelToDelete];
            levelToDelete++;
          }
          $el.data('drupalOriginalTabIndices', tabInfo);
        }
      }
    }
  });

  /**
   * Stores a set of tabbable elements.
   *
   * This constraint can be removed with the release() method.
   *
   * @constructor Drupal~TabbingContext
   *
   * @param {object} options
   *   A set of initiating values
   * @param {number} options.level
   *   The level in the TabbingManager's stack of this tabbingContext.
   * @param {jQuery} options.$tabbableElements
   *   The DOM elements that should be reachable via the tab key when this
   *   tabbingContext is active.
   * @param {jQuery} options.$disabledElements
   *   The DOM elements that should not be reachable via the tab key when this
   *   tabbingContext is active.
   * @param {bool} options.released
   *   A released tabbingContext can never be activated again. It will be
   *   cleaned up when the TabbingManager unwinds its stack.
   * @param {bool} options.active
   *   When true, the tabbable elements of this tabbingContext will be reachable
   *   via the tab key and the disabled elements will not. Only one
   *   tabbingContext can be active at a time.
   */
  function TabbingContext(options) {

    $.extend(this, /** @lends Drupal~TabbingContext# */{

      /**
       * @type {?number}
       */
      level: null,

      /**
       * @type {jQuery}
       */
      $tabbableElements: $(),

      /**
       * @type {jQuery}
       */
      $disabledElements: $(),

      /**
       * @type {bool}
       */
      released: false,

      /**
       * @type {bool}
       */
      active: false
    }, options);
  }

  /**
   * Add public methods to the TabbingContext class.
   */
  $.extend(TabbingContext.prototype, /** @lends Drupal~TabbingContext# */{

    /**
     * Releases this TabbingContext.
     *
     * Once a TabbingContext object is released, it can never be activated
     * again.
     *
     * @fires event:drupalTabbingContextReleased
     */
    release: function () {
      if (!this.released) {
        this.deactivate();
        this.released = true;
        Drupal.tabbingManager.release(this);
        // Allow modules to respond to the tabbingContext release event.
        $(document).trigger('drupalTabbingContextReleased', this);
      }
    },

    /**
     * Activates this TabbingContext.
     *
     * @fires event:drupalTabbingContextActivated
     */
    activate: function () {
      // A released TabbingContext object can never be activated again.
      if (!this.active && !this.released) {
        this.active = true;
        Drupal.tabbingManager.activate(this);
        // Allow modules to respond to the constrain event.
        $(document).trigger('drupalTabbingContextActivated', this);
      }
    },

    /**
     * Deactivates this TabbingContext.
     *
     * @fires event:drupalTabbingContextDeactivated
     */
    deactivate: function () {
      if (this.active) {
        this.active = false;
        Drupal.tabbingManager.deactivate(this);
        // Allow modules to respond to the constrain event.
        $(document).trigger('drupalTabbingContextDeactivated', this);
      }
    }
  });

  // Mark this behavior as processed on the first pass and return if it is
  // already processed.
  if (Drupal.tabbingManager) {
    return;
  }

  /**
   * @type {Drupal~TabbingManager}
   */
  Drupal.tabbingManager = new TabbingManager();

}(jQuery, Drupal));
;
/**
 * @file
 * Attaches behaviors for the Contextual module's edit toolbar tab.
 */

(function ($, Drupal, Backbone) {

  'use strict';

  var strings = {
    tabbingReleased: Drupal.t('Tabbing is no longer constrained by the Contextual module.'),
    tabbingConstrained: Drupal.t('Tabbing is constrained to a set of @contextualsCount and the edit mode toggle.'),
    pressEsc: Drupal.t('Press the esc key to exit.')
  };

  /**
   * Initializes a contextual link: updates its DOM, sets up model and views.
   *
   * @param {HTMLElement} context
   *   A contextual links DOM element as rendered by the server.
   */
  function initContextualToolbar(context) {
    if (!Drupal.contextual || !Drupal.contextual.collection) {
      return;
    }

    var contextualToolbar = Drupal.contextualToolbar;
    var model = contextualToolbar.model = new contextualToolbar.StateModel({
      // Checks whether localStorage indicates we should start in edit mode
      // rather than view mode.
      // @see Drupal.contextualToolbar.VisualView.persist
      isViewing: localStorage.getItem('Drupal.contextualToolbar.isViewing') !== 'false'
    }, {
      contextualCollection: Drupal.contextual.collection
    });

    var viewOptions = {
      el: $('.toolbar .toolbar-bar .contextual-toolbar-tab'),
      model: model,
      strings: strings
    };
    new contextualToolbar.VisualView(viewOptions);
    new contextualToolbar.AuralView(viewOptions);
  }

  /**
   * Attaches contextual's edit toolbar tab behavior.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches contextual toolbar behavior on a contextualToolbar-init event.
   */
  Drupal.behaviors.contextualToolbar = {
    attach: function (context) {
      if ($('body').once('contextualToolbar-init').length) {
        initContextualToolbar(context);
      }
    }
  };

  /**
   * Namespace for the contextual toolbar.
   *
   * @namespace
   */
  Drupal.contextualToolbar = {

    /**
     * The {@link Drupal.contextualToolbar.StateModel} instance.
     *
     * @type {?Drupal.contextualToolbar.StateModel}
     */
    model: null
  };

})(jQuery, Drupal, Backbone);
;
/**
 * @file
 * A Backbone Model for the state of Contextual module's edit toolbar tab.
 */

(function (Drupal, Backbone) {

  'use strict';

  Drupal.contextualToolbar.StateModel = Backbone.Model.extend(/** @lends Drupal.contextualToolbar.StateModel# */{

    /**
     * @type {object}
     *
     * @prop {bool} isViewing
     * @prop {bool} isVisible
     * @prop {number} contextualCount
     * @prop {Drupal~TabbingContext} tabbingContext
     */
    defaults: /** @lends Drupal.contextualToolbar.StateModel# */{

      /**
       * Indicates whether the toggle is currently in "view" or "edit" mode.
       *
       * @type {bool}
       */
      isViewing: true,

      /**
       * Indicates whether the toggle should be visible or hidden. Automatically
       * calculated, depends on contextualCount.
       *
       * @type {bool}
       */
      isVisible: false,

      /**
       * Tracks how many contextual links exist on the page.
       *
       * @type {number}
       */
      contextualCount: 0,

      /**
       * A TabbingContext object as returned by {@link Drupal~TabbingManager}:
       * the set of tabbable elements when edit mode is enabled.
       *
       * @type {?Drupal~TabbingContext}
       */
      tabbingContext: null
    },

    /**
     * Models the state of the edit mode toggle.
     *
     * @constructs
     *
     * @augments Backbone.Model
     *
     * @param {object} attrs
     *   Attributes for the backbone model.
     * @param {object} options
     *   An object with the following option:
     * @param {Backbone.collection} options.contextualCollection
     *   The collection of {@link Drupal.contextual.StateModel} models that
     *   represent the contextual links on the page.
     */
    initialize: function (attrs, options) {
      // Respond to new/removed contextual links.
      this.listenTo(options.contextualCollection, 'reset remove add', this.countContextualLinks);
      this.listenTo(options.contextualCollection, 'add', this.lockNewContextualLinks);

      // Automatically determine visibility.
      this.listenTo(this, 'change:contextualCount', this.updateVisibility);

      // Whenever edit mode is toggled, lock all contextual links.
      this.listenTo(this, 'change:isViewing', function (model, isViewing) {
        options.contextualCollection.each(function (contextualModel) {
          contextualModel.set('isLocked', !isViewing);
        });
      });
    },

    /**
     * Tracks the number of contextual link models in the collection.
     *
     * @param {Drupal.contextual.StateModel} contextualModel
     *   The contextual links model that was added or removed.
     * @param {Backbone.Collection} contextualCollection
     *    The collection of contextual link models.
     */
    countContextualLinks: function (contextualModel, contextualCollection) {
      this.set('contextualCount', contextualCollection.length);
    },

    /**
     * Lock newly added contextual links if edit mode is enabled.
     *
     * @param {Drupal.contextual.StateModel} contextualModel
     *   The contextual links model that was added.
     * @param {Backbone.Collection} [contextualCollection]
     *    The collection of contextual link models.
     */
    lockNewContextualLinks: function (contextualModel, contextualCollection) {
      if (!this.get('isViewing')) {
        contextualModel.set('isLocked', true);
      }
    },

    /**
     * Automatically updates visibility of the view/edit mode toggle.
     */
    updateVisibility: function () {
      this.set('isVisible', this.get('contextualCount') > 0);
    }

  });

})(Drupal, Backbone);
;
/**
 * @file
 * A Backbone View that provides the aural view of the edit mode toggle.
 */

(function ($, Drupal, Backbone, _) {

  'use strict';

  Drupal.contextualToolbar.AuralView = Backbone.View.extend(/** @lends Drupal.contextualToolbar.AuralView# */{

    /**
     * Tracks whether the tabbing constraint announcement has been read once.
     *
     * @type {bool}
     */
    announcedOnce: false,

    /**
     * Renders the aural view of the edit mode toggle (screen reader support).
     *
     * @constructs
     *
     * @augments Backbone.View
     *
     * @param {object} options
     *   Options for the view.
     */
    initialize: function (options) {
      this.options = options;

      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'change:isViewing', this.manageTabbing);

      $(document).on('keyup', _.bind(this.onKeypress, this));
    },

    /**
     * @inheritdoc
     *
     * @return {Drupal.contextualToolbar.AuralView}
     *   The current contextual toolbar aural view.
     */
    render: function () {
      // Render the state.
      this.$el.find('button').attr('aria-pressed', !this.model.get('isViewing'));

      return this;
    },

    /**
     * Limits tabbing to the contextual links and edit mode toolbar tab.
     */
    manageTabbing: function () {
      var tabbingContext = this.model.get('tabbingContext');
      // Always release an existing tabbing context.
      if (tabbingContext) {
        tabbingContext.release();
        Drupal.announce(this.options.strings.tabbingReleased);
      }
      // Create a new tabbing context when edit mode is enabled.
      if (!this.model.get('isViewing')) {
        tabbingContext = Drupal.tabbingManager.constrain($('.contextual-toolbar-tab, .contextual'));
        this.model.set('tabbingContext', tabbingContext);
        this.announceTabbingConstraint();
        this.announcedOnce = true;
      }
    },

    /**
     * Announces the current tabbing constraint.
     */
    announceTabbingConstraint: function () {
      var strings = this.options.strings;
      Drupal.announce(Drupal.formatString(strings.tabbingConstrained, {
        '@contextualsCount': Drupal.formatPlural(Drupal.contextual.collection.length, '@count contextual link', '@count contextual links')
      }));
      Drupal.announce(strings.pressEsc);
    },

    /**
     * Responds to esc and tab key press events.
     *
     * @param {jQuery.Event} event
     *   The keypress event.
     */
    onKeypress: function (event) {
      // The first tab key press is tracked so that an annoucement about tabbing
      // constraints can be raised if edit mode is enabled when the page is
      // loaded.
      if (!this.announcedOnce && event.keyCode === 9 && !this.model.get('isViewing')) {
        this.announceTabbingConstraint();
        // Set announce to true so that this conditional block won't run again.
        this.announcedOnce = true;
      }
      // Respond to the ESC key. Exit out of edit mode.
      if (event.keyCode === 27) {
        this.model.set('isViewing', true);
      }
    }

  });

})(jQuery, Drupal, Backbone, _);
;
/**
 * @file
 * A Backbone View that provides the visual view of the edit mode toggle.
 */

(function (Drupal, Backbone) {

  'use strict';

  Drupal.contextualToolbar.VisualView = Backbone.View.extend(/** @lends Drupal.contextualToolbar.VisualView# */{

    /**
     * Events for the Backbone view.
     *
     * @return {object}
     *   A mapping of events to be used in the view.
     */
    events: function () {
      // Prevents delay and simulated mouse events.
      var touchEndToClick = function (event) {
        event.preventDefault();
        event.target.click();
      };

      return {
        click: function () {
          this.model.set('isViewing', !this.model.get('isViewing'));
        },
        touchend: touchEndToClick
      };
    },

    /**
     * Renders the visual view of the edit mode toggle.
     *
     * Listens to mouse & touch and handles edit mode toggle interactions.
     *
     * @constructs
     *
     * @augments Backbone.View
     */
    initialize: function () {
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'change:isViewing', this.persist);
    },

    /**
     * @inheritdoc
     *
     * @return {Drupal.contextualToolbar.VisualView}
     *   The current contextual toolbar visual view.
     */
    render: function () {
      // Render the visibility.
      this.$el.toggleClass('hidden', !this.model.get('isVisible'));
      // Render the state.
      this.$el.find('button').toggleClass('is-active', !this.model.get('isViewing'));

      return this;
    },

    /**
     * Model change handler; persists the isViewing value to localStorage.
     *
     * `isViewing === true` is the default, so only stores in localStorage when
     * it's not the default value (i.e. false).
     *
     * @param {Drupal.contextualToolbar.StateModel} model
     *   A {@link Drupal.contextualToolbar.StateModel} model.
     * @param {bool} isViewing
     *   The value of the isViewing attribute in the model.
     */
    persist: function (model, isViewing) {
      if (!isViewing) {
        localStorage.setItem('Drupal.contextualToolbar.isViewing', 'false');
      }
      else {
        localStorage.removeItem('Drupal.contextualToolbar.isViewing');
      }
    }

  });

})(Drupal, Backbone);
;
/**
 * @file
 * Replaces the home link in toolbar with a back to site link.
 */

(function ($, Drupal, drupalSettings) {

  'use strict';

  var pathInfo = drupalSettings.path;
  var escapeAdminPath = sessionStorage.getItem('escapeAdminPath');
  var windowLocation = window.location;

  // Saves the last non-administrative page in the browser to be able to link
  // back to it when browsing administrative pages. If there is a destination
  // parameter there is not need to save the current path because the page is
  // loaded within an existing "workflow".
  if (!pathInfo.currentPathIsAdmin && !/destination=/.test(windowLocation.search)) {
    sessionStorage.setItem('escapeAdminPath', windowLocation);
  }

  /**
   * Replaces the "Home" link with "Back to site" link.
   *
   * Back to site link points to the last non-administrative page the user
   * visited within the same browser tab.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches the replacement functionality to the toolbar-escape-admin element.
   */
  Drupal.behaviors.escapeAdmin = {
    attach: function () {
      var $toolbarEscape = $('[data-toolbar-escape-admin]').once('escapeAdmin');
      if ($toolbarEscape.length && pathInfo.currentPathIsAdmin) {
        if (escapeAdminPath !== null) {
          $toolbarEscape.attr('href', escapeAdminPath);
        }
        else {
          $toolbarEscape.text(Drupal.t('Home'));
        }
        $toolbarEscape.closest('.toolbar-tab').removeClass('hidden');
      }
    }
  };

})(jQuery, Drupal, drupalSettings);
;
;
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
;
