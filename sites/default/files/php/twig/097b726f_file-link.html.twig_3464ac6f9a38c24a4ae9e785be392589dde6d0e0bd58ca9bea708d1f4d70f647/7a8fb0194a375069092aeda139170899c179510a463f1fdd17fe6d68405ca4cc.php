<?php

/* themes/bootstrap/templates/file/file-link.html.twig */
class __TwigTemplate_af3cd72949d6e949a02389bc7e24d0a45b0ef49d110f8f846acd469875b62f38 extends Twig_Template
{
    public function __construct(Twig_Environment $env)
    {
        parent::__construct($env);

        $this->parent = false;

        $this->blocks = array(
        );
    }

    protected function doDisplay(array $context, array $blocks = array())
    {
        $tags = array("spaceless" => 16, "set" => 18, "if" => 24);
        $filters = array("clean_class" => 20);
        $functions = array();

        try {
            $this->env->getExtension('sandbox')->checkSecurity(
                array('spaceless', 'set', 'if'),
                array('clean_class'),
                array()
            );
        } catch (Twig_Sandbox_SecurityError $e) {
            $e->setTemplateFile($this->getTemplateName());

            if ($e instanceof Twig_Sandbox_SecurityNotAllowedTagError && isset($tags[$e->getTagName()])) {
                $e->setTemplateLine($tags[$e->getTagName()]);
            } elseif ($e instanceof Twig_Sandbox_SecurityNotAllowedFilterError && isset($filters[$e->getFilterName()])) {
                $e->setTemplateLine($filters[$e->getFilterName()]);
            } elseif ($e instanceof Twig_Sandbox_SecurityNotAllowedFunctionError && isset($functions[$e->getFunctionName()])) {
                $e->setTemplateLine($functions[$e->getFunctionName()]);
            }

            throw $e;
        }

        // line 16
        ob_start();
        // line 17
        echo "  ";
        // line 18
        $context["classes"] = array(0 => ((        // line 19
(isset($context["icon_only"]) ? $context["icon_only"] : null)) ? ("icon-only") : ("")), 1 => (( !        // line 20
(isset($context["icon_only"]) ? $context["icon_only"] : null)) ? (("icon-" . \Drupal\Component\Utility\Html::getClass((isset($context["icon_position"]) ? $context["icon_position"] : null)))) : ("")));
        // line 23
        echo "  <span";
        echo $this->env->getExtension('sandbox')->ensureToStringAllowed($this->env->getExtension('drupal_core')->escapeFilter($this->env, $this->getAttribute((isset($context["attributes"]) ? $context["attributes"] : null), "addClass", array(0 => (isset($context["classes"]) ? $context["classes"] : null)), "method"), "html", null, true));
        echo ">
    ";
        // line 24
        if ((isset($context["icon_only"]) ? $context["icon_only"] : null)) {
            // line 25
            echo "      <span class=\"file-icon\">";
            echo $this->env->getExtension('sandbox')->ensureToStringAllowed($this->env->getExtension('drupal_core')->escapeFilter($this->env, (isset($context["icon"]) ? $context["icon"] : null), "html", null, true));
            echo "</span>
      <span class=\"sr-only\">
        <span class=\"file-link\">";
            // line 27
            echo $this->env->getExtension('sandbox')->ensureToStringAllowed($this->env->getExtension('drupal_core')->escapeFilter($this->env, (isset($context["link"]) ? $context["link"] : null), "html", null, true));
            echo "</span>
        <span class=\"file-size\">";
            // line 28
            echo $this->env->getExtension('sandbox')->ensureToStringAllowed($this->env->getExtension('drupal_core')->escapeFilter($this->env, (isset($context["file_size"]) ? $context["file_size"] : null), "html", null, true));
            echo "</span>
      </span>
    ";
        } else {
            // line 31
            echo "      ";
            if (((isset($context["icon_position"]) ? $context["icon_position"] : null) == "after")) {
                // line 32
                echo "        <span class=\"file-link\">";
                echo $this->env->getExtension('sandbox')->ensureToStringAllowed($this->env->getExtension('drupal_core')->escapeFilter($this->env, (isset($context["link"]) ? $context["link"] : null), "html", null, true));
                echo "</span><span class=\"file-size\">";
                echo $this->env->getExtension('sandbox')->ensureToStringAllowed($this->env->getExtension('drupal_core')->escapeFilter($this->env, (isset($context["file_size"]) ? $context["file_size"] : null), "html", null, true));
                echo "</span><span class=\"file-icon\">";
                echo $this->env->getExtension('sandbox')->ensureToStringAllowed($this->env->getExtension('drupal_core')->escapeFilter($this->env, (isset($context["icon"]) ? $context["icon"] : null), "html", null, true));
                echo "</span>
      ";
            } else {
                // line 34
                echo "        <span class=\"file-icon\">";
                echo $this->env->getExtension('sandbox')->ensureToStringAllowed($this->env->getExtension('drupal_core')->escapeFilter($this->env, (isset($context["icon"]) ? $context["icon"] : null), "html", null, true));
                echo "</span><span class=\"file-link\">";
                echo $this->env->getExtension('sandbox')->ensureToStringAllowed($this->env->getExtension('drupal_core')->escapeFilter($this->env, (isset($context["link"]) ? $context["link"] : null), "html", null, true));
                echo "</span><span class=\"file-size\">";
                echo $this->env->getExtension('sandbox')->ensureToStringAllowed($this->env->getExtension('drupal_core')->escapeFilter($this->env, (isset($context["file_size"]) ? $context["file_size"] : null), "html", null, true));
                echo "</span>
      ";
            }
            // line 36
            echo "    ";
        }
        // line 37
        echo "  </span>
";
        echo trim(preg_replace('/>\s+</', '><', ob_get_clean()));
    }

    public function getTemplateName()
    {
        return "themes/bootstrap/templates/file/file-link.html.twig";
    }

    public function isTraitable()
    {
        return false;
    }

    public function getDebugInfo()
    {
        return array (  100 => 37,  97 => 36,  87 => 34,  77 => 32,  74 => 31,  68 => 28,  64 => 27,  58 => 25,  56 => 24,  51 => 23,  49 => 20,  48 => 19,  47 => 18,  45 => 17,  43 => 16,);
    }
}
/* {#*/
/* /***/
/*  * @file*/
/*  * Theme override for a link to a file.*/
/*  **/
/*  * Available variables:*/
/*  * - attributes: The HTML attributes for the containing element.*/
/*  * - link: A link to the file.*/
/*  * - icon: An icon.*/
/*  * - icon_only: Flag to display only the icon and not the label.*/
/*  * - icon_position: Where an icon should be displayed.*/
/*  **/
/*  * @see \Drupal\bootstrap\Plugin\Preprocess\FileLink::preprocessVariables*/
/*  *//* */
/* #}*/
/* {% spaceless %}*/
/*   {%*/
/*     set classes = [*/
/*       icon_only ? 'icon-only',*/
/*       not icon_only ? 'icon-' ~ icon_position|clean_class*/
/*     ]*/
/*   %}*/
/*   <span{{ attributes.addClass(classes) }}>*/
/*     {% if icon_only %}*/
/*       <span class="file-icon">{{ icon }}</span>*/
/*       <span class="sr-only">*/
/*         <span class="file-link">{{ link }}</span>*/
/*         <span class="file-size">{{ file_size }}</span>*/
/*       </span>*/
/*     {% else %}*/
/*       {% if icon_position == 'after' %}*/
/*         <span class="file-link">{{ link }}</span><span class="file-size">{{ file_size }}</span><span class="file-icon">{{ icon }}</span>*/
/*       {% else %}*/
/*         <span class="file-icon">{{ icon }}</span><span class="file-link">{{ link }}</span><span class="file-size">{{ file_size }}</span>*/
/*       {% endif %}*/
/*     {% endif %}*/
/*   </span>*/
/* {% endspaceless %}*/
/* */
