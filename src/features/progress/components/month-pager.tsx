import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-provider';
import type { DateKey } from '@/utils/date-key';

import { CalendarGrid, getGridHeight } from './calendar-grid';
import { monthKeyId } from '../domain/calendar-month';
import type { MonthWindow } from '../hooks/use-month-window';

interface MonthPagerProps {
  window: MonthWindow;
  today: DateKey;
  onSelectDay: (date: DateKey) => void;
  /** `-1` for the previous month, `+1` for the next. */
  onStepMonth: (step: number) => void;
}

const CENTER_PAGE = 1;

/**
 * Horizontally swipeable month view with unbounded navigation.
 *
 * Only three months are mounted at a time. After a swipe settles, the parent's
 * month advances and the scroll position is silently recentred, so paging can
 * continue indefinitely in either direction without growing the page list.
 */
export function MonthPager({ window: monthWindow, today, onSelectDay, onStepMonth }: MonthPagerProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);

  const pages = [monthWindow.previous, monthWindow.current, monthWindow.next];

  // Sizing to the tallest visible month keeps a 6-row neighbour from being clipped
  // mid-swipe, while still collapsing for short months once settled.
  const targetHeight = getGridHeight(Math.max(...pages.map((page) => page.calendar.weeks.length)));
  const height = useSharedValue(targetHeight);

  useEffect(() => {
    height.value = reducedMotion ? targetHeight : withTiming(targetHeight, { duration: theme.duration.base });
  }, [targetHeight, height, reducedMotion, theme.duration.base]);

  const containerStyle = useAnimatedStyle(() => ({ height: height.value }));

  const recentre = useCallback(() => {
    if (width === 0) return;
    scrollRef.current?.scrollTo({ x: width * CENTER_PAGE, animated: false });
  }, [width]);

  // Re-centre whenever the month changes, including taps on the chevrons. A layout
  // effect keeps the jump in the same frame as the new pages, so the swipe settles
  // without a visible flash of the neighbouring month.
  const currentMonthId = monthKeyId(monthWindow.current.calendar.key);
  useLayoutEffect(() => {
    recentre();
  }, [currentMonthId, recentre]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width === 0) return;
      const page = Math.round(event.nativeEvent.contentOffset.x / width);
      if (page === CENTER_PAGE) return;
      onStepMonth(page - CENTER_PAGE);
    },
    [width, onStepMonth],
  );

  return (
    <Animated.View style={containerStyle} onLayout={handleLayout}>
      {width === 0 ? null : (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
          contentOffset={{ x: width * CENTER_PAGE, y: 0 }}
          scrollEventThrottle={16}
          decelerationRate="fast"
          accessibilityLabel="Monthly reading calendar"
          accessibilityHint="Swipe left or right to change month"
        >
          {pages.map((page) => (
            <View key={monthKeyId(page.calendar.key)} style={{ width }}>
              <CalendarGrid
                month={page.calendar}
                readings={page.readings}
                today={today}
                onSelectDay={onSelectDay}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}
