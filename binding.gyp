{
  "targets": [
    {
      "target_name": "vibrancy_alpha",
      "sources": ["native/vibrancy_alpha.mm"],
      "xcode_settings": {
        "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
        "MACOSX_DEPLOYMENT_TARGET": "13.0",
        "OTHER_CPLUSPLUSFLAGS": ["-std=c++17"]
      },
      "link_settings": {
        "libraries": ["-framework Cocoa"]
      }
    }
  ]
}
