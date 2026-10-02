---
type: Idea
title: Testing on real phones
description: How the end-to-end checks could run closer to real Android and iOS devices than headless Chromium with a phone-sized window, and what each way needs.
tags: [testing, mobile, e2e, proposal]
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-01T06:00:00Z }
---

# Summary

Noted for later on 2026-10-01, after the user's Android phone showed problems
the end-to-end checks had missed: the toolbar half under the keyboard, and
the header scrolling away on long pages. `mise run e2e` uses headless desktop
Chromium with a phone's size, touch and user agent. That catches layout
problems, but it has no on-screen keyboard and none of a phone browser's own
viewport behaviour. A shorter window stands in for the keyboard, which is
what Android does since the page asks it to (`interactive-widget=resizes-content`).

The plan, when it is wanted:

- **Every run:** headless Chromium, as now, plus Playwright's WebKit with an
  iPhone profile.
- **Before a release, or after changing the phone layout:** the walkthroughs
  on a real Android phone over `adb` (`mise run e2e:phone`).
- **iPhone:** checked by hand, unless someone has a Mac.

# Android

1. **A real phone over USB or Wi-Fi.** Recommended.
   - **Setup:** turn on USB debugging, install `adb` (`android-tools` on Arch),
     then `adb forward tcp:9222 localabstract:chrome_devtools_remote`.
   - **Running:** Playwright attaches to the phone's Chrome with
     `chromium.connect_over_cdp` and runs the existing walkthroughs.
     Screenshots come from the real screen.
   - **Gives:** the real browser, keyboard, fonts and screen, with no large
     installs.
   - **Catch:** taps sent through Playwright may not open the keyboard, but
     `adb shell input tap x y` does, so the keyboard checks use that.
2. **The Android emulator, without a window.** Real Chrome on a virtual
   device, with a soft keyboard; works without a phone and could run in CI.
   - **Cost:** several GB of SDK and system image, KVM, a slow start, and
     Chrome images that are often outdated.
   - **Use:** only for CI.
3. **Cloud device farms (BrowserStack and others).** Paid, external and
   online, against the project's offline and private stance. Not planned.

# iOS

Every browser on iOS is Safari's engine (WebKit), which does not speak the
Chrome debugging protocol, so Playwright cannot attach to it as it can on
Android.

1. **Playwright's WebKit with an iPhone profile,** on Linux.
   - **Gives:** the same engine family as Safari, though not Safari itself.
     It catches WebKit differences in layout, sticky positioning, fonts and
     SVG.
   - **Lacks:** a keyboard.
   - **Use:** cheap enough for every run.
2. **With a Mac:** Apple's `safaridriver` drives Safari in the iOS Simulator
   or on a cabled iPhone, through WebDriver, with real Safari and a real
   keyboard.
   - **Catch:** the checks must run on the Mac.
   - **Avoid:** bridges from Linux (`ios-webkit-debug-proxy` with a protocol
     adapter) are unmaintained and only partly work.
3. **By hand:** use the dashboard on an iPhone over the tunnel and send
   screenshots.

On iOS the keyboard covers the page rather than shrinking it, so the
toolbar's fallback (`FormatBar.svelte`, placed from the visual viewport until
it settles) is code that only an iPhone exercises. It needs a check on a real
iPhone before it can be trusted.

See [editing in the app](/tasks/T30-dashboard-editing.md) for the phone
problems that prompted this.
