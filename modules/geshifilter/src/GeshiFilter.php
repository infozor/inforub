<?php
/**
 * @file
 * Definition of Drupal\geshifilter\GeshiFilter.
 */

namespace Drupal\geshifilter;

/**
 * Contains constantas and some helper functions.
 */
class GeshiFilter {
  /**
   * Default for sintax highting, format as plain text.
   */
  const DEFAULT_PLAINTEXT = 'GESHIFILTER_DEFAULT_PLAINTEXT';

  /**
   * Default for sintax highting, do nothing.
   */
  const DEFAULT_DONOTHING = 'GESHIFILTER_DEFAULT_DONOTHING';

  /**
   * CSS modes, inline.
   */
  const CSS_INLINE = 1;

  /**
   * Usage of CSS classes and an automatically managaged external stylesheet.
   */
  const CSS_CLASSES_AUTOMATIC = 2;

  /**
   * Only add CSS classes to markup.
   *
   * Admin/themer is responsible for defining the CSS rules.
   */
  const CSS_CLASSES_ONLY = 3;

  /**
   * Attributes valid to set language, by example, [code language="php"].
   */
  const ATTRIBUTES_LANGUAGE = 'type lang language class';

  /**
   * Attributes valid to set line numbering.
   */
  const ATTRIBUTE_LINE_NUMBERING = 'linenumbers';

  /**
   * Attributes valid to set line start.
   */
  const ATTRIBUTE_LINE_NUMBERING_START = 'start';

  /**
   * Attributes valid to set the interval of fancy lines.
   */
  const ATTRIBUTE_FANCY_N = 'fancy';

  /**
   * Attributes valid to set title.
   */
  const ATTRIBUTE_TITLE = 'title';

  /**
   * Parse code with tags inside <>, example, <code>.
   */
  const BRACKETS_ANGLE = 1;

  /**
   * Parse code with tags inside [], example, [code].
   */
  const BRACKETS_SQUARE = 2;

  /**
   * Deprecated, only used in upgrade path.
   */
  const BRACKETS_BOTH = 3;

  /**
   * Parse code with tags inside [[]], example, [[code]].
   */
  const BRACKETS_DOUBLESQUARE = 4;

  /**
   * Parse code with tags inside <?php ?>, example, <?php echo('hi'); ?>.
   */
  const BRACKETS_PHPBLOCK = 8;

  /**
   * No line numbers.
   */
  const LINE_NUMBERS_DEFAULT_NONE = 0;

  /**
   * Normal line numbers.
   */
  const LINE_NUMBERS_DEFAULT_NORMAL = 1;

  /**
   * Fancy line numbers, each 5.
   */
  const LINE_NUMBERS_DEFAULT_FANCY5 = 5;

  /**
   * Fancy line numbers, each 10.
   */
  const LINE_NUMBERS_DEFAULT_FANCY10 = 10;

  /**
   * Fancy line numbers, each 20.
   */
  const LINE_NUMBERS_DEFAULT_FANCY20 = 20;

  /**
   * Helper function for splitting a string on white spaces.
   *
   * Using explode(' ', $string) is not enough because it returns empty elements
   * if $string contains consecutive spaces.
   *
   * @param string $string
   *   The string to split by spaces.
   *
   * @return array
   *   Return the string split by white spaces.
   */
  public static function whitespaceExplode($string) {
    return preg_split('/\s+/', $string, -1, PREG_SPLIT_NO_EMPTY);
  }

  /**
   * Split a string with tags to an array.
   *
   * @param string $string
   *   The tags to split.
   *
   * @return array
   *   The tag split.
   */
  public static function tagSplit($string) {
    return preg_split('/\s+|<|>|\[|\]/', $string, -1, PREG_SPLIT_NO_EMPTY);
  }
  /**
   * List of available languages.
   *
   * @return array
   *   An array mapping language code to array with the language path and
   *   full language name.
   */
  public static function getAvailableLanguages() {
    // Try to get it from cache (database actually).
    $cache = \Drupal::cache();
    $available_languages = $cache->get('geshifilter_available_languages_cache');
    if (!$available_languages) {
      // Not in cache: build the array of available_languages.
      $geshi_library = libraries_load('geshi');
      $available_languages = array();
      if ($geshi_library['loaded']) {
        $dirs = array(
          $geshi_library['library path'] . '/geshi',
          drupal_get_path('module', 'geshifilter') . '/geshi-extra',
        );
        foreach ($dirs as $dir) {
          foreach (file_scan_directory($dir, '/.[pP][hH][pP]$/i') as $filename => $fileinfo) {
            // Short name.
            $name = $fileinfo->name;
            // Get full name.
            $geshi = new \GeSHi('', $name);
            $geshi->set_language_path($dir);
            $fullname = $geshi->get_language_name();
            unset($geshi);
            // Store.
            $available_languages[$name] = array('language_path' => $dir, 'fullname' => $fullname);
          }
        }
        ksort($available_languages);
        // Save array to database.
        $cache->set('geshifilter_available_languages_cache', $available_languages);
      }
    }
    else {
      $available_languages = $available_languages->data;
    }
    return $available_languages;
  }

  /**
   * List of enabled languages(with caching).
   *
   * @return array
   *   Array with enabled languages mapping language code to full name.
   */
  public static function getEnabledLanguages() {
    $config = \Drupal::config('geshifilter.settings');
    static $enabled_languages = NULL;
    if ($enabled_languages === NULL) {
      $enabled_languages = array();
      $languages = self::getAvailableLanguages();
      foreach ($languages as $language => $language_data) {
        if ($config->get('language.' . $language . ".enabled")) {
          $enabled_languages[$language] = $language_data['fullname'];
        }
      }
    }
    return $enabled_languages;
  }

}
