<?php

/**
 * @file
 * Contains \Drupal\nice_menus\Form\NiceMenusSettingsForm.
 */

namespace Drupal\nice_menus\Form;

use Drupal\system\SystemConfigFormBase;
use Drupal;

/**
 * Provides a nice menus settings form.
 */
class NiceMenusSettingsForm extends SystemConfigFormBase {

  /**
   * Implements \Drupal\Core\Form\FormInterface::getFormID().
   */
  public function getFormID() {
    return 'nice_menus_settings';
  }

  /**
   * Implements \Drupal\Core\Form\FormInterface::buildForm().
   */
  public function buildForm(array $form, array &$form_state) {
    $config = Drupal::config('nice_menus.settings');
    // Use JavaScript configuration setting.
    $form['nice_menus_js'] = array(
      '#type' => 'checkbox',
      '#title' => t('Use JavaScript'),
      '#description' => t('This will add Superfish jQuery to Nice menus. This is required for Nice menus to work properly in Internet Explorer.'),
      '#default_value' => $config->get('nice_menus_js'),
    );
    $form['nice_menus_sf_options'] = array(
      '#type' => 'fieldset',
      '#title' => t('Advanced: Superfish options'),
      '#description' => t('You can change the default Superfish options by filling out the desired values here. These only take effect if the Use JavaScript box above is checked.'),
      '#collapsible' => TRUE,
      '#collapsed' => TRUE,
    );
    // Mouse delay textfield for the time before the menus is closed.
    $form['nice_menus_sf_options']['nice_menus_sf_delay'] = array(
      '#type' => 'textfield',
      '#title' => t('Mouse delay'),
      '#description' => t('The delay in milliseconds that the mouse can remain outside a submenu without it closing.'),
      '#default_value' => $config->get('nice_menus_sf_delay'),
      '#size' => 5,
    );
    // Display speed of the animation for the menu to open/close.
    $form['nice_menus_sf_options']['nice_menus_sf_speed'] = array(
      '#type' => 'select',
      '#title' => t('Animation speed'),
      '#description' => t('Speed of the menu open/close animation.'),
      '#options' => array(
        'slow' => t('slow'),
        'normal' => t('normal'),
        'fast' => t('fast'),
      ),
      '#default_value' => $config->get('nice_menus_sf_speed'),
    );
    return parent::buildForm($form, $form_state);
  }

  public function validateForm(array &$form, array &$form_state) {
    if(!is_numeric($form_state['values']['nice_menus_sf_delay'])) {
      form_set_error('nice_menus_sf_delay', $this->t('Mouse delay Must be a number.'));
    }
    parent::validateForm($form, $form_state);
  }

  /**
   * {@inheritdoc}
   */
  public function submitForm(array &$form, array &$form_state) {
    Drupal::config('nice_menus.settings')
        ->set('nice_menus_sf_delay', $form_state['values']['nice_menus_sf_delay'])
        ->set('nice_menus_js', $form_state['values']['nice_menus_js'])
        ->set('nice_menus_sf_speed', $form_state['values']['nice_menus_sf_speed'])
        ->save();
    parent::submitForm($form, $form_state);
  }
}
