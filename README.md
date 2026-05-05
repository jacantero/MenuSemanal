# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

This is the standard anatomy of any professional React Native app using Expo:

    📁 node_modules/ 

        This is the heaviest folder. It contains thousands of files with third-party code that makes React Native and Expo work under the hood.

        Golden rule of programming: Never modify anything inside this folder. It is generated automatically.

    📁 assets/

        This is where we will store static files. For example, the SVG icons you exported from Figma, generic images for recipes, your logo, or custom fonts.

    📄 App.js 

        (Note: Depending on the exact template, sometimes it can be an index.js or index.tsx file inside a folder called app/tabs/).

        It is the main entry point. It's where the screens of the application draw when the user opens it. All the code we write will branch out from here.

    📄 package.json

        It is a text file in JSON format. It contains the "identity" of your app: its name, its current version (e.g., 1.0.0), and, most importantly, an exact list of the "dependencies" (external packages) that your app needs to work.

    📄 app.json

        Here we configure how the app behaves at the operating system level. In this file, you can define what the app's icon will be on the mobile screen, the color of the loading screen (splash screen), or if you want to lock the screen so it's only viewed in portrait mode and doesn't rotate.

    📄 .gitignore

       When you upload your code to the internet (for example, to GitHub to keep backups), this file contains a list of things that should not be uploaded. For example, it tells the system to ignore the heavy node_modules folder.