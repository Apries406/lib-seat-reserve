export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/seat/index',
    'pages/checkin/index',
    'pages/profile/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#5B6AF0',
    navigationBarTitleText: '自习座位',
    navigationBarTextStyle: 'white'
  },
  tabBar: {
    color: '#A0A5BD',
    selectedColor: '#5B6AF0',
    backgroundColor: '#fff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/tab/home.png',
        selectedIconPath: 'assets/tab/home-active.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tab/profile.png',
        selectedIconPath: 'assets/tab/profile-active.png'
      }
    ]
  }
})
