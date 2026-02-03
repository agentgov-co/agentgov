'use client'

import React from 'react'

/**
 * HydrationFix - Removes browser extension injected attributes/elements before React hydration.
 *
 * This fixes hydration mismatch errors caused by extensions like:
 * - Password managers (Shark, LastPass, 1Password)
 * - Grammarly
 * - ColorZilla
 * - LanguageTool
 *
 * @see https://github.com/vercel/next.js/discussions/72035
 * @see https://nextjs.org/docs/messages/react-hydration-error
 */
export function HydrationFix({ nonce }: { nonce?: string }): React.JSX.Element {
  return (
    <script
      id="hydration-fix"
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            // List of extension-injected attributes to remove
            var extensionAttrs = [
              'data-sharkid',
              'data-sharklabel',
              'data-shark',
              'cz-shortcut-listen',
              'data-lt-installed',
              'data-grammarly-part',
              'data-gramm',
              'data-gramm_editor'
            ];

            // List of extension-injected elements to remove
            var extensionSelectors = [
              'shark-icon-container',
              'grammarly-extension',
              'grammarly-desktop-integration'
            ];

            // Remove attributes from all elements
            function cleanAttributes(root) {
              var elements = root.querySelectorAll('*');
              elements.forEach(function(el) {
                extensionAttrs.forEach(function(attr) {
                  if (el.hasAttribute(attr)) {
                    el.removeAttribute(attr);
                  }
                });
              });
              // Also clean root element
              extensionAttrs.forEach(function(attr) {
                if (root.hasAttribute && root.hasAttribute(attr)) {
                  root.removeAttribute(attr);
                }
              });
            }

            // Remove extension elements
            function cleanElements() {
              extensionSelectors.forEach(function(selector) {
                var elements = document.querySelectorAll(selector);
                elements.forEach(function(el) {
                  el.remove();
                });
              });
            }

            // Initial cleanup
            if (document.body) {
              cleanAttributes(document.body);
              cleanElements();
            }

            // Watch for future changes
            var observer = new MutationObserver(function(mutations) {
              mutations.forEach(function(mutation) {
                // Handle attribute changes
                if (mutation.type === 'attributes') {
                  var attr = mutation.attributeName;
                  if (extensionAttrs.indexOf(attr) !== -1) {
                    mutation.target.removeAttribute(attr);
                  }
                }
                // Handle added nodes
                if (mutation.type === 'childList') {
                  mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) {
                      // Check if it's an extension element
                      var tagName = node.tagName ? node.tagName.toLowerCase() : '';
                      if (extensionSelectors.indexOf(tagName) !== -1) {
                        node.remove();
                        return;
                      }
                      // Clean attributes on added elements
                      cleanAttributes(node);
                    }
                  });
                }
              });
            });

            if (document.body) {
              observer.observe(document.body, {
                attributes: true,
                attributeFilter: extensionAttrs,
                childList: true,
                subtree: true
              });
            }
          })();
        `,
      }}
    />
  )
}
