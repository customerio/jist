Pod::Spec.new do |spec|
  spec.name         = "Jist"
  spec.version      = "0.1.0" # Don't modify this line - it's automatically updated
  spec.summary      = "Customer.io Jist — native iOS renderer for JSON-template messages."
  spec.homepage     = "https://github.com/customerio/jist"
  spec.license      = { :type => "MIT", :file => "LICENSE" }
  spec.author       = { "CustomerIO Team" => "win@customer.io" }

  # The pod is published from the jist monorepo. CocoaPods clones the whole repo at the tag, but
  # `source_files` scopes compilation to the iOS sources only — consumer binaries reference iOS
  # code only. The monorepo uses platform-prefixed tags (e.g. ios-v0.1.0).
  spec.source       = { :git => 'https://github.com/customerio/jist.git', :tag => "ios-v#{spec.version}" }

  spec.swift_version = '6.0'
  spec.cocoapods_version = '>= 1.11.0'

  spec.platform = :ios
  spec.ios.deployment_target = "15.0"

  spec.source_files = "ios/Sources/Jist/**/*.swift"

  spec.module_name = "Jist" # the `import Jist` name in Swift files
end
