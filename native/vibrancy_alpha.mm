#include <node_api.h>

#import <Cocoa/Cocoa.h>

#include <algorithm>
#include <cmath>
#include <cstring>
#include <string>
#include <unistd.h>

namespace {

napi_value Throw(napi_env env, const char* message) {
  napi_throw_error(env, nullptr, message);
  return nullptr;
}

NSView* ViewFromHandle(napi_env env, napi_value value) {
  bool is_buffer = false;
  if (napi_is_buffer(env, value, &is_buffer) != napi_ok || !is_buffer) {
    Throw(env, "Expected BrowserWindow.getNativeWindowHandle() Buffer");
    return nil;
  }

  void* data = nullptr;
  size_t length = 0;
  if (napi_get_buffer_info(env, value, &data, &length) != napi_ok ||
      data == nullptr || length < sizeof(void*)) {
    Throw(env, "Invalid native window handle Buffer");
    return nil;
  }

  void* raw_pointer = nullptr;
  std::memcpy(&raw_pointer, data, sizeof(raw_pointer));
  return (__bridge NSView*)raw_pointer;
}

NSVisualEffectView* VibrancyViewForNativeView(NSView* native_view) {
  if (native_view == nil) return nil;

  NSWindow* window = [native_view window];
  if (window == nil) return nil;

  NSView* content_view = [window contentView];
  NSVisualEffectView* match = nil;
  NSUInteger match_count = 0;
  NSRect content_bounds = [content_view bounds];
  constexpr CGFloat tolerance = 1.0;
  for (NSView* child in [content_view subviews]) {
    if (![child isKindOfClass:[NSVisualEffectView class]]) continue;
    NSVisualEffectView* candidate = static_cast<NSVisualEffectView*>(child);
    if ([candidate window] != window) continue;
    if ([candidate blendingMode] != NSVisualEffectBlendingModeBehindWindow) continue;

    NSRect effect_frame = [candidate frame];
    const bool covers_content =
      std::abs(NSMinX(content_bounds) - NSMinX(effect_frame)) <= tolerance &&
      std::abs(NSMinY(content_bounds) - NSMinY(effect_frame)) <= tolerance &&
      std::abs(NSWidth(content_bounds) - NSWidth(effect_frame)) <= tolerance &&
      std::abs(NSHeight(content_bounds) - NSHeight(effect_frame)) <= tolerance;
    if (!covers_content) continue;

    match = candidate;
    match_count += 1;
  }
  if (match_count != 1 || match == nil) return nil;
  return match;
}

napi_value SetAlpha(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok ||
      argc < 2) {
    return Throw(env, "setAlpha(handle, alpha) requires two arguments");
  }

  NSView* native_view = ViewFromHandle(env, argv[0]);
  if (native_view == nil) return nullptr;

  double requested_alpha = 1.0;
  if (napi_get_value_double(env, argv[1], &requested_alpha) != napi_ok) {
    return Throw(env, "alpha must be a number");
  }
  const double alpha = std::clamp(requested_alpha, 0.0, 1.0);

  __block bool found = false;
  void (^apply_alpha)(void) = ^{
    @autoreleasepool {
      NSVisualEffectView* vibrancy_view = VibrancyViewForNativeView(native_view);
      if (vibrancy_view != nil) {
        [vibrancy_view setAlphaValue:alpha];
        found = true;
      }
    }
  };

  if ([NSThread isMainThread]) {
    apply_alpha();
  } else {
    dispatch_sync(dispatch_get_main_queue(), apply_alpha);
  }

  napi_value result;
  napi_get_boolean(env, found, &result);
  return result;
}

napi_value GetAlpha(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok ||
      argc < 1) {
    return Throw(env, "getAlpha(handle) requires a native handle");
  }

  NSView* native_view = ViewFromHandle(env, argv[0]);
  if (native_view == nil) return nullptr;

  __block double alpha = -1.0;
  void (^read_alpha)(void) = ^{
    @autoreleasepool {
      NSVisualEffectView* vibrancy_view = VibrancyViewForNativeView(native_view);
      if (vibrancy_view != nil) alpha = [vibrancy_view alphaValue];
    }
  };
  if ([NSThread isMainThread]) {
    read_alpha();
  } else {
    dispatch_sync(dispatch_get_main_queue(), read_alpha);
  }

  napi_value result;
  napi_create_double(env, alpha, &result);
  return result;
}

napi_value Inspect(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  if (napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr) != napi_ok ||
      argc < 1) {
    return Throw(env, "inspect(handle) requires a native handle");
  }

  NSView* native_view = ViewFromHandle(env, argv[0]);
  if (native_view == nil) return nullptr;

  __block std::string description = "no-window";
  void (^inspect_view)(void) = ^{
    @autoreleasepool {
      NSWindow* window = [native_view window];
      if (window == nil) return;
      NSView* content_view = [window contentView];
      NSVisualEffectView* vibrancy_view = VibrancyViewForNativeView(native_view);
      NSUInteger direct_effect_count = 0;
      NSUInteger full_window_effect_count = 0;
      NSRect content_bounds = [content_view bounds];
      constexpr CGFloat tolerance = 1.0;
      for (NSView* child in [content_view subviews]) {
        if (![child isKindOfClass:[NSVisualEffectView class]]) continue;
        direct_effect_count += 1;
        NSVisualEffectView* candidate = static_cast<NSVisualEffectView*>(child);
        NSRect frame = [candidate frame];
        const bool full_window =
          [candidate window] == window &&
          [candidate blendingMode] == NSVisualEffectBlendingModeBehindWindow &&
          std::abs(NSMinX(content_bounds) - NSMinX(frame)) <= tolerance &&
          std::abs(NSMinY(content_bounds) - NSMinY(frame)) <= tolerance &&
          std::abs(NSWidth(content_bounds) - NSWidth(frame)) <= tolerance &&
          std::abs(NSHeight(content_bounds) - NSHeight(frame)) <= tolerance;
        if (full_window) full_window_effect_count += 1;
      }
      NSString* native_class = NSStringFromClass([native_view class]);
      NSString* content_class = NSStringFromClass([content_view class]);
      NSString* effect_class = vibrancy_view == nil
        ? @"none"
        : NSStringFromClass([vibrancy_view class]);
      description = std::string([[NSString stringWithFormat:
        @"native=%@; content=%@; directChildren=%lu; directEffects=%lu; fullWindowEffects=%lu; effect=%@; alpha=%.3f; mainThread=%@",
        native_class,
        content_class,
        static_cast<unsigned long>([[content_view subviews] count]),
        static_cast<unsigned long>(direct_effect_count),
        static_cast<unsigned long>(full_window_effect_count),
        effect_class,
        vibrancy_view == nil ? -1.0 : [vibrancy_view alphaValue],
        [NSThread isMainThread] ? @"yes" : @"no"] UTF8String]);
    }
  };

  if ([NSThread isMainThread]) {
    inspect_view();
  } else {
    dispatch_sync(dispatch_get_main_queue(), inspect_view);
  }

  napi_value result;
  napi_create_string_utf8(env, description.c_str(), description.size(), &result);
  return result;
}

napi_value ProcessId(napi_env env, napi_callback_info info) {
  napi_value result;
  napi_create_int64(env, static_cast<int64_t>(getpid()), &result);
  return result;
}

napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor properties[] = {
    {"setAlpha", nullptr, SetAlpha, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"getAlpha", nullptr, GetAlpha, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"inspect", nullptr, Inspect, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"processId", nullptr, ProcessId, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  napi_define_properties(
    env,
    exports,
    sizeof(properties) / sizeof(properties[0]),
    properties);
  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
