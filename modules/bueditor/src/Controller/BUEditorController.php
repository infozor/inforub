<?php

/**
 * @file
 * Contains \Drupal\bueditor\Controller\BUEditorController.
 */

namespace Drupal\bueditor\Controller;

use Drupal\Core\Controller\ControllerBase;

/**
 * Controller routines for bueditor routes.
 */
class BUEditorController extends ControllerBase {

  /**
   * Returns an administrative overview of BUEditor Editors.
   */
  public function adminOverview() {
    $output['editors'] = array(
      '#type' => 'container',
      '#attributes' => array('class' => array('bueditor-editor-list')),
      'title' => array('#markup' => '<h2>' . $this->t('Available editors') . '</h2>'),
      'list' => $this->entityManager()->getListBuilder('bueditor_editor')->render(),
    );
    $output['#attached']['library'][] = 'bueditor/drupal.bueditor.admin';
    return $output;
  }

  /**
   * Returns an administrative overview of BUEditor Buttons.
   */
  public function buttonsOverview() {
    // Custom buttons
    $output['custom_buttons'] = array(
      '#type' => 'container',
      '#attributes' => array('class' => array('bueditor-button-list bbl-custom')),
      'title' => array('#markup' => '<h2>' . $this->t('Custom buttons') . '</h2>'),
      'list' => $this->entityManager()->getListBuilder('bueditor_button')->render(),
    );
    // Plugin buttons
    $groups = array();
    $header = array(
      array('data' => $this->t('ID'), 'class' => 'button-id'),
      array('data' => $this->t('Name'), 'class' => 'button-label'),
    );
    foreach (\Drupal::service('plugin.manager.bueditor.plugin')->getButtonGroups() as $key => $group) {
      $rows = array();
      foreach ($group['buttons'] as $bid => $data) {
        $rows[] = array($bid, isset($data['label']) ? $data['label'] : '');
      }
      $groups[$key] = array(
        '#theme' => 'table',
        '#header' => $header,
        '#rows' => $rows,
        '#caption' => $group['label'],
        '#attributes' => array('class' => array('bueditor-button-group bbg-' . $key)),
      );
    }
    $output['plugin_buttons'] = array(
      '#type' => 'details',
      '#attributes' => array('class' => array('bueditor-button-list bbl-plugins')),
      '#title' => $this->t('Plugin buttons'),
      'list' => $groups,
    );
    $output['#attached']['library'][] = 'bueditor/drupal.bueditor.admin';
    return $output;
  }

}
