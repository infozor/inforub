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

      // Add a "Loading???" message, hide it underneath the CKEditor toolbar,
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

      // After a short delay, show "Loading???" message.
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

(function ($) {

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
        var $link = $('<span class="field-edit-link"><button type="button" class="link link-edit-summary btn btn-default btn-xs pull-right" data-toggle="button" aria-pressed="false" autocomplete="off">' + Drupal.t('Hide summary') + '</button></span>');
        var $button = $link.find('button');
        var toggleClick = true;
        $link.on('click', function (e) {
          if (toggleClick) {
            $summary.hide();
            $button.html(Drupal.t('Edit summary'));
            $fullLabel.before($link);
          }
          else {
            $summary.show();
            $button.html(Drupal.t('Hide summary'));
            $summaryLabel.before($link);
          }
          e.preventDefault();
          toggleClick = !toggleClick;
        });
        $summaryLabel.before($link);

        // If no summary is set, hide the summary field.
        if ($widget.find('.js-text-summary').val() === '') {
          $link.trigger('click');
        }
        else {
          $link.addClass('active');
        }
      });
    }
  };

})(jQuery);
;
