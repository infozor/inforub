<?php
/**
 * @file
 * Definition of Drupal\geshifield\Tests\GeshiFieldTest.
 */

// Namespace of tests.
namespace Drupal\geshifield\Tests;

use \Drupal\geshifilter\GeshiFilter;

// Use of base class for the tests.
use Drupal\simpletest\WebTestBase;

/**
 * Tests for GeshiField in node content.
 *
 * Those tests are for the content of the node, to make sure they are
 * processed by geshi library.
 *
 * @group geshifilter
 */
class GeshiFieldTest extends WebTestBase {

  /**
   * A global filter adminstrator.
   */
  protected $adminUser;

  /**
   * Object with configuration.
   *
   * @var \Drupal\Core\Config\Config
   */
  protected $config;

  /**
   * List of modules to enable.
   *
   * @var array
   */
  public static $modules = array('node', 'libraries', 'geshifilter', 'filter', 'geshifield', 'field_ui');

  /**
   * Code run before each and every test method.
   */
  public function setUp() {
    parent::setUp();

    // Create object with configuration.
    $this->config = \Drupal::configFactory()
      ->getEditable('geshifilter.settings');

    // And set the path to the geshi library.
    $this->config->set('geshi_dir', '/libraries/geshi');

    // Create a content type, as we will create nodes on test.
    $settings = array(
      // Override default type (a random name).
      'type' => 'geshifilter_content_type',
      'name' => 'Geshifilter Content',
    );
    $this->drupalCreateContentType($settings);

    $this->adminUser = $this->drupalCreateUser(array(), NULL, TRUE);

    // Log in with filter admin user.
    $this->drupalLogin($this->adminUser);

    // Add an text format with only geshi filter.
    $this->createTextFormat('geshifilter_text_format', array('filter_geshifilter'));

    // Set some default GeSHi filter admin settings.
    // Set default highlighting mode to "do nothing".
    $this->config->set('default_highlighting', GeshiFilter::DEFAULT_PLAINTEXT);
    $this->config->set('use_format_specific_options', FALSE);
    $this->config->set('tag_styles', array(
      GeshiFilter::BRACKETS_ANGLE => GeshiFilter::BRACKETS_ANGLE,
      GeshiFilter::BRACKETS_SQUARE => GeshiFilter::BRACKETS_SQUARE,
    ));
    $this->config->set('default_line_numbering', GeshiFilter::LINE_NUMBERS_DEFAULT_NONE);
    $this->config->save();
  }

  /**
   * Create a new text format.
   *
   * @param string $format_name
   *   The name of new text format.
   * @param array $filters
   *   Array with the machine names of filters to enable.
   */
  protected function createTextFormat($format_name, array $filters) {
    $edit = array();
    $edit['format'] = $format_name;
    $edit['name'] = $this->randomMachineName();
    $edit['roles[' . DRUPAL_AUTHENTICATED_RID . ']'] = 1;
    foreach ($filters as $filter) {
      $edit['filters[' . $filter . '][status]'] = TRUE;
    }
    $this->drupalPostForm('admin/config/content/formats/add', $edit, t('Save configuration'));
    $this->assertRaw(t('Added text format %format.', array('%format' => $edit['name'])), 'New filter created.');
    $this->drupalGet('admin/config/content/formats');
  }

  public function testAddField() {

    $this->addField('geshifield', 'geshi', 'GeshiFilter Field');
    $this->createNode('title','body','<?php echo("hi"); ?>', 'php');

  }

  private function createNode($title, $body, $sourcecode, $language) {
    // Create a node.
    $node = array(
      'title[0][value]' => $title,
      'body[0][value]' => $body,
      'field_geshi[0][sourcecode]' => $sourcecode,
      'field_geshi[0][language]' => $language,
    );
    $this->drupalPostForm('node/add/geshifilter_content_type', $node, 'Save and publish');
    $this->drupalGet('node/1');
  }

  private function addField($type, $name, $label, $values = array(), $instance = array()) {
    // Choose field type and name.
    $edit = array();
    $edit['new_storage_type'] = $type;
    $edit['label'] = $label;
    $edit['field_name'] = $name;
    $this->drupalPostForm('admin/structure/types/manage/geshifilter_content_type/fields/add-field', $edit, 'Save and continue');

    // Number of values in field, keep the default, 1.
    $this->drupalPostForm(NULL, $values, 'Save field settings');

    // Settings for this instance of field, keep the default.
    $this->drupalPostForm(NULL, $instance, 'Save settings');
  }
}