import { useWindowDimensions } from 'react-native';
import { deviceClassForWidth, type DeviceClass } from '@/theme';

export interface Responsive {
  width: number;
  height: number;
  device: DeviceClass;
  isPhone: boolean;
  isTablet: boolean; // tablet OR largeTablet
  isLargeTablet: boolean;
  isLandscape: boolean;
  /** Pick a value by device class with a phone fallback. */
  select: <T>(opts: { phone: T; tablet?: T; largeTablet?: T }) => T;
  /** Columns for product/menu grids. */
  gridColumns: number;
  /** Max content width to keep layouts readable on big screens. */
  contentMaxWidth: number;
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const device = deviceClassForWidth(width);
  const isTablet = device !== 'phone';
  const isLargeTablet = device === 'largeTablet';

  function select<T>(opts: { phone: T; tablet?: T; largeTablet?: T }): T {
    if (device === 'largeTablet') return opts.largeTablet ?? opts.tablet ?? opts.phone;
    if (device === 'tablet') return opts.tablet ?? opts.phone;
    return opts.phone;
  }

  return {
    width,
    height,
    device,
    isPhone: device === 'phone',
    isTablet,
    isLargeTablet,
    isLandscape: width > height,
    select,
    gridColumns: select({ phone: 2, tablet: 3, largeTablet: 4 }),
    contentMaxWidth: select({ phone: width, tablet: 720, largeTablet: 900 }),
  };
}
