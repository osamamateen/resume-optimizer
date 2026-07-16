const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getThemeSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function getServerThemeSnapshot(): boolean {
  return false;
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setTheme(dark: boolean): void {
  const html = document.documentElement;
  if (dark) {
    html.classList.add("dark");
    window.localStorage.setItem("theme", "dark");
  } else {
    html.classList.remove("dark");
    window.localStorage.setItem("theme", "light");
  }
  notify();
}
