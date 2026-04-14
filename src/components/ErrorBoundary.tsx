'use client'

/**
 * React Error Boundary
 *
 * 렌더링 중 발생한 예외를 잡아 흰 화면(WSOD) 대신 안내 메시지를 표시합니다.
 * - 클래스 컴포넌트만 Error Boundary를 구현할 수 있습니다 (React 제한)
 * - 새로고침 버튼으로 복구 가능
 */

import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] 렌더링 오류:', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, message: '' })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              페이지를 불러오지 못했어요
            </h1>
            <p className="text-sm text-gray-600 mb-1 break-keep">
              예상치 못한 오류가 발생했습니다.
            </p>
            {this.state.message && (
              <p className="text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-2 mt-3 mb-5 text-left break-all font-mono">
                {this.state.message}
              </p>
            )}
            <button
              onClick={this.handleReload}
              className="mt-4 w-full rounded-xl bg-purple-600 py-3 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
