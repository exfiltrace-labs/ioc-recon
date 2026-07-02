import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: '.',
  manifest: {
    name: 'IOC Recon - Context Menu Search',
    short_name: 'IOC Recon',
    description:
      'Right-click selected text to search it across multiple sources at once. Smart-keyword lookups for analysts and power users.',
    minimum_chrome_version: '102',
    permissions: ['contextMenus', 'storage', 'scripting', 'activeTab'],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
    browser_specific_settings: {
      gecko: {
        id: 'ioc-recon@exfiltrace-labs',
        strict_min_version: '128.0',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_title: 'IOC Recon',
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
      },
    },
  },
});
