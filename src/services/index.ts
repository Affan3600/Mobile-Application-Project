import { SmartHomeApi } from './api';
import { MockSmartHomeApi } from './mockApi';

export const api: SmartHomeApi = new MockSmartHomeApi();
