import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default [FirebaseOptions] for use with your Firebase apps.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      case TargetPlatform.windows:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for windows - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyBkfpkyE0d7J6x4cmnlUv8ctJdcZag3478',
    appId: '1:232521904662:android:243c25b16c7fc982207b37',
    messagingSenderId: '232521904662',
    projectId: 'scholar-bites-b1ec3',
    storageBucket: 'scholar-bites-b1ec3.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyCtfzmV4b06hiNoBonLNn7mLiVagsw-X7c',
    appId: '1:232521904662:ios:853f67466940101b207b37',
    messagingSenderId: '232521904662',
    projectId: 'scholar-bites-b1ec3',
    storageBucket: 'scholar-bites-b1ec3.firebasestorage.app',
    iosBundleId: 'com.scholarbites.app',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'AIzaSyCtfzmV4b06hiNoBonLNn7mLiVagsw-X7c',
    appId: '1:232521904662:ios:853f67466940101b207b37',
    messagingSenderId: '232521904662',
    projectId: 'scholar-bites-b1ec3',
    storageBucket: 'scholar-bites-b1ec3.firebasestorage.app',
    iosBundleId: 'com.scholarbites.app',
  );
  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'dummy-api-key-for-web',
    appId: '1:232521904662:web:dummy',
    messagingSenderId: '232521904662',
    projectId: 'scholar-bites-b1ec3',
    authDomain: 'scholar-bites-b1ec3.firebaseapp.com',
    storageBucket: 'scholar-bites-b1ec3.firebasestorage.app',
  );
}
