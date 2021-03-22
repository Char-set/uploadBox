import * as React from 'react'
import { hot } from 'react-hot-loader'
import { BrowserRouter as Router, Route, Link, Switch, Redirect } from "react-router-dom";


import Upload from './pages/upload/Upload.jsx'


import './index.css'

const _App = () => {
    return (
        <Router>
            <Switch>
                <Route path="/">
                    <Upload />
                </Route>
            </Switch>
        </Router>
    )
}

export const App = hot(module)(_App);