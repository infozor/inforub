CodeSnippet

Installation
============

This module requires the core CKEditor module and also the CodeSnippet plugin from CKEditor.com.

1. Download the plugin from http://ckeditor.com/addon/codesnippet at least version 4.5.6.
2. Place the plugin in the root libraries folder (/libraries).
3. Enable CodeSnippet in the Drupal admin.
4. Configure your WYSIWYG toolbar to include the button.

Supported Languages
===================

To add new options to the supported languages option in the admin form, you can use a form alter hook within your own custom module to add on:

function YOURMODULE_form_alter(&$form, FormStateInterface $form_state, $form_id) {
  $form['editor']['settings']['subform']['plugins']['codesnippet']['highlight_languages']['#options']['d'] = 'D';
  $form['editor']['settings']['subform']['plugins']['codesnippet']['highlight_languages']['#options']['rust'] = 'Rust';
}

This would add D and Rust to the list of languages to check off, which will then make them available in the dialog of CKEditor CodeSnippet.

An important thing to note is that the key of the array item needs to match the expected code class for HighlightJS for proper coloring. If you are unsure of the class name, refer to the HighlightJS live demo page and inspect the
codeblock of what you want, and check the class on the code HTML element.

Additionally, you will need to add any new languages to HighlightJS by customizing its build. You can customize the build at https://highlightjs.org/download/

1. Select all the languages you want to support with syntax highlighting and download it.
2. Overwrite /libraries/codesnippet/lib/highlight/highlight.pack.js with this new file.
3. Clear Drupal caches.

Note that code previews syntax highlighting may not look 100% right (in the WYSIWYG), but typically will when viewed on the frontend.

Out of the box, the included version of highlightjs comes with these languages (as defined in config/install/codesnippet.settings.yml):

languages:
  apache: 'Apache'
  bash: 'Bash'
  coffescript: 'CoffeeScript'
  css: 'CSS'
  dart: 'Dart'
  dockerfile: 'Dockerfile'
  dust: 'Dust'
  gherkin: 'Gherkin'
  go: 'Go'
  haml: 'HAML'
  handlebars: 'Handlebars'
  ini: 'Ini'
  java: 'Java'
  javascript: 'JavaScript'
  json: 'JSON'
  less: 'Less'
  makefile: 'Makefile'
  markdown: 'Markdown'
  nginx: 'Nginx'
  php: 'PHP'
  perl: 'Perl'
  powershell: 'Powershell'
  puppet: 'Puppet'
  python: 'Python'
  ruby: 'Ruby'
  scss: 'SCSS'
  sql: 'SQL'
  twig: 'Twig'
  typescript: 'TypeScript'
  yaml: 'Yaml'
  xml: 'HTML/XML'