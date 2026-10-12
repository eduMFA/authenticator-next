Pod::Spec.new do |s|
  s.name = 'EduMfaNotifications'
  s.version = '1.0.0'
  s.summary = 'Native notification actions for eduMFA'
  s.description = 'Background notification actions and device notification state reconciliation.'
  s.author = ''
  s.homepage = 'https://docs.expo.dev/modules/'
  s.platforms = { :ios => '16.4' }
  s.source = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoNotifications'
  s.dependency 'EduMfaRsa'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
