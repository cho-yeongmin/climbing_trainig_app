import { Component } from 'react'
import ErrorFallback from './ErrorFallback'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  reset = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          reset={this.reset}
        />
      )
    }
    return this.props.children
  }
}
