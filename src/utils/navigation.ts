export const safeGoBack = (
  navigation: any,
  fallbackRoute?: string,
  fallbackParams?: Record<string, unknown>,
) => {
  if (navigation?.canGoBack?.()) {
    navigation.goBack();
    return;
  }

  if (fallbackRoute && navigation?.navigate) {
    navigation.navigate(fallbackRoute, fallbackParams);
  }
};
