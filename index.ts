import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import './src/services/backgroundNotificationSync';
import App from './src/App';
import { widgetTaskHandler } from './src/widgets/widgetTaskHandler';

registerRootComponent(App);

if (Platform.OS === 'android') {
  registerWidgetTaskHandler(widgetTaskHandler);
}
