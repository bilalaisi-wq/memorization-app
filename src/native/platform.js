import {Capacitor} from '@capacitor/core';
export const isNativeApp=()=>Capacitor.isNativePlatform();
export const NATIVE_AUTH_RETURN='com.ayahaday.app://auth/callback';
export const VERIFIED_WEB_RETURN='https://ayah-a-day.up.railway.app/native/auth/callback';
export const authRedirect=web=>isNativeApp()?NATIVE_AUTH_RETURN:web;
