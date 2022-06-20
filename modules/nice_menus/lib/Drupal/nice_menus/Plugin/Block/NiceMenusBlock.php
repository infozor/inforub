<?php

/**
 * @file
 * Contains \Drupal\nice_menus\Plugin\Block\NiceMenusBlock.
 */

namespace Drupal\nice_menus\Plugin\Block;

use Drupal\block\BlockBase;
use Drupal\Component\Annotation\Plugin;
use Drupal\Core\Annotation\Translation;

/**
 * Provides a Nice menus block.
 *
 * @Block(
 *   id = "nice_menus_block",
 *   admin_label = @Translation("Nice menus"),
 *   module = "nice_menus"
 * )
 */
class NiceMenusBlock extends BlockBase {

  /**
   * Overrides \Drupal\block\BlockBase::blockForm().
   */
  public function blockForm($form, &$form_state) {
    $configuration = $this->configuration;
    $form['nice_menus_name'] = array(
      '#type' => 'textfield',
      '#title' => t('Menu name'),
      '#default_value' => isset($configuration['nice_menus_name']) ? $configuration['nice_menus_name'] : '',
    );
    $form['nice_menus_menu'] = array(
      '#type' => 'select',
      '#title' => t('Menu parent'),
      '#description' => t('The menu parent from which to show a Nice menu.'),
      '#default_value' => isset($configuration['nice_menus_menu']) ? $configuration['nice_menus_menu'] : 'navigation:0',
      '#options' => menu_parent_options(menu_get_menus()),
    );
    $form['nice_menus_depth'] = array(
      '#type' => 'select',
      '#title' => t('Menu depth'),
      '#description' => t('The depth of the menu, i.e. the number of child levels starting with the parent selected above. Leave set to -1 to display all children and use 0 to display no children.'),
      '#default_value' => isset($configuration['nice_menus_depth']) ? $configuration['nice_menus_depth'] : -1,
      '#options' => array_combine(range(-1, 5), range(-1, 5)),
    );
    $form['nice_menus_type'] = array(
      '#type' => 'select',
      '#title' => t('Menu style'),
      '#description' => t('right: menu items are listed on top of each other and expand to the right') . '<br />' . t('left: menu items are listed on top of each other and expand to the left') . '<br />' . t('down: menu items are listed side by side and expand down'),
      '#default_value' => isset($configuration['nice_menus_type']) ? $configuration['nice_menus_type'] : 'right',
      '#options' => array_combine(array('right', 'left', 'down'), array('right', 'left', 'down')),
    );
    $form['nice_menus_respect_expand'] = array(
      '#type' => 'select',
      '#title' => t('Respect "Show as expanded" option'),
      '#description' => t('Menu items have a "Show as expanded" option, which is disabled by default. Since menu items do NOT have this option checked by default, you should choose Yes here once you have configured the menu items that you DO want to expand.'),
      '#options' => array(
        0 => t('No'),
        1 => t('Yes'),
      ),
      '#default_value' => isset($configuration['nice_menus_respect_expand']) ? $configuration['nice_menus_respect_expand'] : 0,
    );

    return $form;
  }

  /**
   * Overrides \Drupal\block\BlockBase::blockSubmit().
   */
  public function blockSubmit($form, &$form_state) {
    $this->configuration = array(
      'nice_menus_name' => $form_state['values']['nice_menus_name'],
      'nice_menus_menu' => $form_state['values']['nice_menus_menu'],
      'nice_menus_depth' => $form_state['values']['nice_menus_depth'],
      'nice_menus_type' => $form_state['values']['nice_menus_type'],
      'nice_menus_respect_expand' => $form_state['values']['nice_menus_respect_expand'],
    );
  }

  /**
   * {@inheritdoc}
   */
  public function build() {
    $nice_menus_menu = isset($this->configuration['nice_menus_menu']) ? $this->configuration['nice_menus_menu'] : 'navigation:0';
    list($menu_name, $mlid) = explode(':', $nice_menus_menu);
    $build = array(
      '#theme' => 'nice_menus',
      '#menu_name' => $menu_name,
      '#mlid' => $mlid,
      '#direction' => $this->configuration['nice_menus_type'],
      '#depth' => $this->configuration['nice_menus_depth'],
      '#respect_expanded' => $this->configuration['nice_menus_respect_expand'],
    );
    return $build;
  }

}
