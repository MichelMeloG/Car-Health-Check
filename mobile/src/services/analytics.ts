import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAnalytics,
  logEvent,
  logSignUp as logSignUpEvent,
} from '@react-native-firebase/analytics';

type FirstEvent = 'first_vehicle_created' | 'first_expense_created';

async function logFirstEvent(userId: string, event: FirstEvent) {
  const key = `analytics:${event}:${userId}`;
  if (await AsyncStorage.getItem(key)) return;

  try {
    await logEvent(getAnalytics(), event);
    await AsyncStorage.setItem(key, '1');
  } catch {
    // Analytics nunca pode impedir o salvamento dos dados do usuário.
  }
}

export function logSignUp() {
  try {
    return logSignUpEvent(getAnalytics(), { method: 'password' }).catch(() => undefined);
  } catch {
    return Promise.resolve();
  }
}

export function logFirstVehicleCreated(userId: string) {
  return logFirstEvent(userId, 'first_vehicle_created');
}

export function logFirstExpenseCreated(userId: string) {
  return logFirstEvent(userId, 'first_expense_created');
}
