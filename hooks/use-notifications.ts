"use client";

import { useState, useEffect } from "react";

// Função auxiliar para converter chave VAPID base64 para Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setSubscription(sub);
    } catch (err) {
      console.error("Erro ao checar subscrição", err);
    } finally {
      setLoading(false);
    }
  };

  const subscribe = async () => {
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") return;

      const registration = await navigator.serviceWorker.ready;
      
      // NOTA: Em produção, substitua pela sua VAPID PUBLIC KEY gerada
      const vapidPublicKey = "BPYp_C8cAn8-Y_I1h9q_K4eBw6j_1-7q8-z-z-z-z-z-z-z-z-z-z-z-z-z-z-z-z-z-z-z-z"; 
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      setSubscription(sub);
      
      // TODO: Enviar subscrição para o servidor (Supabase)
      console.log("Subscrição criada:", JSON.stringify(sub));
      return sub;
    } catch (err) {
      console.error("Falha ao subscrever notificações", err);
    }
  };

  const unsubscribe = async () => {
    if (!subscription) return;
    try {
      await subscription.unsubscribe();
      setSubscription(null);
    } catch (err) {
      console.error("Erro ao cancelar subscrição", err);
    }
  };

  return { isSupported, permission, subscription, subscribe, unsubscribe, loading };
}
