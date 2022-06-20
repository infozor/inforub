<?php

/**
 * @file
 * Implementation of the conflict detection feature of the GeSHi filter.
 */

// Namespace for the module.
namespace Drupal\geshifilter;

/**
 * Class to detect conflic with other filters.
 *
 * @todo Make this class work, see https://www.drupal.org/node/2354511.
 */
class GeshiFilterConflicts {

  /**
   * Menu callback for filter conflicts page.
   *
   * @return array
   *   An array with the filter conflics found, or an empty array if there is
   *   no conflics.
   */
  public static function listConflicts() {
    return array();
  }

}
