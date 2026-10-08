// Allows the module graph to be evaluated during SSR (e.g. Next.js), where
// HTMLElement and customElements do not exist. Elements are only defined in a browser.
export const SafeHTMLElement = (
  typeof HTMLElement !== 'undefined' ? HTMLElement : class {}
) as typeof HTMLElement;

export const canDefineElements = typeof customElements !== 'undefined';
